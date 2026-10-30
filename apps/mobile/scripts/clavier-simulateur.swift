// Branche ou débranche le clavier matériel d'un simulateur iOS, comme le menu
// « I/O > Keyboard > Connect Hardware Keyboard » de Simulator.app, qui
// n'affiche pas un jeu d'appareils à part (cf. RECETTE-MOBILE.md). Débranché,
// iOS montre son clavier à l'écran dès qu'un champ prend le focus : c'est ce
// qui a permis de voir une feuille du design system monter avec lui, au lot 5
// du chantier 30. Une frappe par `idb ui text` le rebranche.
//
//   xcrun swift scripts/clavier-simulateur.swift <UDID> 0|1 [jeu d'appareils]
//
// Le jeu d'appareils par défaut est celui de Simulator.app. L'appel passe par
// `-[SimDevice setHardwareKeyboardEnabled:keyboardType:error:]`, une méthode
// privée de CoreSimulator : rien d'autre n'est touché.
import Foundation
import ObjectiveC

let args = CommandLine.arguments
guard args.count >= 3, args[2] == "0" || args[2] == "1" else {
  print("usage : clavier-simulateur.swift <UDID> 0|1 [jeu d'appareils]")
  exit(1)
}
let udid = args[1]
let enabled = args[2] == "1"
let setPath =
  args.count > 3
  ? args[3]
  : NSString(string: "~/Library/Developer/CoreSimulator/Devices").expandingTildeInPath

guard
  let bundle = Bundle(path: "/Library/Developer/PrivateFrameworks/CoreSimulator.framework"),
  bundle.load(),
  let deviceClass: AnyClass = NSClassFromString("SimDevice"),
  let contextClass = NSClassFromString("SimServiceContext") as? NSObject.Type
else {
  print("CoreSimulator introuvable")
  exit(1)
}

// +[SimServiceContext sharedServiceContextForDeveloperDir:error:], puis
// -[SimServiceContext deviceSetWithPath:error:]
typealias LookupFn = @convention(c) (AnyObject, Selector, NSString, UnsafeMutablePointer<NSError?>?) -> AnyObject?
var error: NSError?
let contextSel = NSSelectorFromString("sharedServiceContextForDeveloperDir:error:")
let contextImp = unsafeBitCast(
  class_getMethodImplementation(object_getClass(contextClass), contextSel), to: LookupFn.self)
let developerDir = ProcessInfo.processInfo.environment["DEVELOPER_DIR"]
  ?? "/Applications/Xcode.app/Contents/Developer"
guard let context = contextImp(contextClass, contextSel, developerDir as NSString, &error) else {
  print("contexte : \(error?.localizedDescription ?? "?")")
  exit(1)
}
let setSel = NSSelectorFromString("deviceSetWithPath:error:")
let setImp = unsafeBitCast(class_getMethodImplementation(object_getClass(context), setSel), to: LookupFn.self)
guard let deviceSet = setImp(context, setSel, setPath as NSString, &error),
  let byUDID = deviceSet.value(forKey: "devicesByUDID") as? NSDictionary,
  let uuid = NSUUID(uuidString: udid),
  let device = byUDID[uuid] as? NSObject
else {
  print("appareil \(udid) absent de \(setPath)")
  exit(1)
}

// Signature relevée sur Xcode 26 : B32@0:8B16C20^@24, le type de clavier en
// octet ; il ne compte pas pour le débrancher.
let selector = NSSelectorFromString("setHardwareKeyboardEnabled:keyboardType:error:")
guard let method = class_getInstanceMethod(deviceClass, selector) else {
  print("méthode absente de cette version de CoreSimulator")
  exit(1)
}
typealias KeyboardFn = @convention(c) (AnyObject, Selector, Bool, UInt8, UnsafeMutablePointer<NSError?>?) -> Bool
let keyboardImp = unsafeBitCast(method_getImplementation(method), to: KeyboardFn.self)
if keyboardImp(device, selector, enabled, 0, &error) {
  print("clavier matériel \(enabled ? "branché" : "débranché") : \(device.value(forKey: "name") ?? udid)")
} else {
  print("refus : \(error?.localizedDescription ?? "?")")
  exit(1)
}
