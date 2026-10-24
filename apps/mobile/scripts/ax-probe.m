// Sonde de recette, jamais compilée dans l'app : injectée au lancement d'un dev
// client sur le simulateur, elle relève les traits d'accessibilité réels des
// vues UIKit, sans passer par un client d'accessibilité comme `idb`, dont le
// compagnon garde en mémoire le rôle de la première vie d'une vue recyclée.
// Cf. `docs/RECETTE-MOBILE.md`, « `idb` garde le rôle de la première vie
// d'une vue recyclée ».
//
//   xcrun -sdk iphonesimulator clang -arch arm64 -mios-simulator-version-min=15.1 \
//     -dynamiclib -fobjc-arc -framework UIKit -o /tmp/ax-probe.dylib apps/mobile/scripts/ax-probe.m
//   SIMCTL_CHILD_DYLD_INSERT_LIBRARIES=/tmp/ax-probe.dylib \
//     xcrun simctl launch <UDID> com.bentopop.mobile
//
// Elle écrit dans le dossier `tmp` du conteneur de données de l'app :
//
// - `ax-probe.json`, chaque seconde : tous les éléments d'accessibilité de
//   toutes les fenêtres, leur adresse, leur classe, leur libellé, leurs traits
//   UIKit et leur cadre ;
// - `ax-events.json` : les recyclages (`prepareForRecycle`) et les poses de
//   props (`updateProps:oldProps:`) de `RCTViewComponentView` pour les vues qui
//   portent un libellé, traits d'avant et d'après, `mount` pour un montage.
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

static NSMutableArray *gEvents;
static NSUInteger gSeq;

static NSString *Short(NSString *s) {
  if (![s isKindOfClass:[NSString class]]) return @"";
  return s.length > 70 ? [s substringToIndex:70] : s;
}

static void Record(NSDictionary *event) {
  if (!gEvents) gEvents = [NSMutableArray new];
  NSMutableDictionary *e = [event mutableCopy];
  e[@"seq"] = @(++gSeq);
  [gEvents addObject:e];
  if (gEvents.count > 6000) [gEvents removeObjectsInRange:NSMakeRange(0, 1000)];
}

// `hidden` : la vue ou un ancêtre est masqué au lecteur d'écran.
static void Collect(UIView *v, BOOL hidden, NSMutableArray *out) {
  BOOL h = hidden || v.accessibilityElementsHidden || v.hidden;
  if (v.isAccessibilityElement) {
    CGRect r = [v convertRect:v.bounds toView:nil];
    [out addObject:@{
      @"ptr" : [NSString stringWithFormat:@"%p", v],
      @"cls" : NSStringFromClass(v.class),
      @"label" : Short(v.accessibilityLabel),
      @"traits" : @(v.accessibilityTraits),
      @"hidden" : @(h),
      @"x" : @(r.origin.x), @"y" : @(r.origin.y), @"w" : @(r.size.width), @"h" : @(r.size.height),
    }];
  }
  for (UIView *c in v.subviews) Collect(c, h, out);
}

static void Write(id object, NSString *name) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
  [data writeToFile:[NSTemporaryDirectory() stringByAppendingPathComponent:name] atomically:YES];
}

static void Dump(void) {
  NSMutableArray *out = [NSMutableArray new];
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) continue;
    for (UIWindow *w in ((UIWindowScene *)scene).windows) Collect(w, NO, out);
  }
  Write(@{@"at" : @([NSDate date].timeIntervalSince1970), @"elements" : out}, @"ax-probe.json");
  Write(gEvents ?: @[], @"ax-events.json");
}

static void Swizzle(Class cls, SEL sel, IMP (^make)(IMP original)) {
  Method m = class_getInstanceMethod(cls, sel);
  if (!m) return;
  method_setImplementation(m, make(method_getImplementation(m)));
}

__attribute__((constructor)) static void Start(void) {
  dispatch_async(dispatch_get_main_queue(), ^{
    Class view = NSClassFromString(@"RCTViewComponentView");
    if (view) {
      SEL recycle = NSSelectorFromString(@"prepareForRecycle");
      Swizzle(view, recycle, ^IMP(IMP original) {
        return imp_implementationWithBlock(^(UIView *self) {
          NSString *label = Short(self.accessibilityLabel);
          if (label.length) {
            Record(@{@"kind" : @"recycle", @"ptr" : [NSString stringWithFormat:@"%p", self],
                     @"label" : label, @"traits" : @(self.accessibilityTraits)});
          }
          ((void (*)(id, SEL))original)(self, recycle);
        });
      });
      // `updateProps:oldProps:` prend deux `std::shared_ptr` par référence :
      // pour l'ABI, deux pointeurs, transmis tels quels. Un montage passe
      // `nullptr` pour les anciennes props.
      SEL update = NSSelectorFromString(@"updateProps:oldProps:");
      Swizzle(view, update, ^IMP(IMP original) {
        return imp_implementationWithBlock(^(UIView *self, const void *props, const void *oldProps) {
          UIAccessibilityTraits before = self.accessibilityTraits;
          NSString *beforeLabel = Short(self.accessibilityLabel);
          ((void (*)(id, SEL, const void *, const void *))original)(self, update, props, oldProps);
          NSString *label = Short(self.accessibilityLabel);
          if (label.length || beforeLabel.length) {
            Record(@{@"kind" : @"props", @"ptr" : [NSString stringWithFormat:@"%p", self],
                     @"cls" : NSStringFromClass(self.class), @"before" : beforeLabel,
                     @"label" : label, @"traitsBefore" : @(before),
                     @"traits" : @(self.accessibilityTraits),
                     @"mount" : @(oldProps == NULL || *(void *const *)oldProps == NULL)});
          }
        });
      });
    }
    [NSTimer scheduledTimerWithTimeInterval:1.0 repeats:YES block:^(NSTimer *t) { Dump(); }];
  });
}
