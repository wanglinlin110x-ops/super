import AppKit

let outputPath = CommandLine.arguments.dropFirst().first ?? "AppIcon.png"
let size = NSSize(width: 1024, height: 1024)
let colorSpace = CGColorSpaceCreateDeviceRGB()
let bytesPerRow = 1024 * 4
let bitmapData = UnsafeMutableRawPointer.allocate(byteCount: bytesPerRow * 1024, alignment: 64)
defer { bitmapData.deallocate() }

guard let context = CGContext(
    data: bitmapData,
    width: 1024,
    height: 1024,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
) else {
    fatalError("Unable to create graphics context")
}
let canvas = CGRect(origin: .zero, size: size)

let background = CGGradient(
    colorsSpace: colorSpace,
    colors: [
        NSColor(calibratedRed: 0.067, green: 0.090, blue: 0.208, alpha: 1).cgColor,
        NSColor(calibratedRed: 0.008, green: 0.012, blue: 0.035, alpha: 1).cgColor
    ] as CFArray,
    locations: [0, 1]
)!
context.drawLinearGradient(
    background,
    start: CGPoint(x: 130, y: 920),
    end: CGPoint(x: 900, y: 90),
    options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
)

context.saveGState()
context.setShadow(offset: .zero, blur: 100, color: NSColor(calibratedRed: 0.35, green: 0.41, blue: 0.78, alpha: 0.48).cgColor)
context.setFillColor(NSColor(calibratedRed: 0.35, green: 0.41, blue: 0.78, alpha: 0.24).cgColor)
context.fillEllipse(in: CGRect(x: 208, y: 208, width: 608, height: 608))
context.restoreGState()

let orb = CGGradient(
    colorsSpace: colorSpace,
    colors: [
        NSColor(calibratedRed: 0.82, green: 0.87, blue: 1, alpha: 1).cgColor,
        NSColor(calibratedRed: 0.50, green: 0.59, blue: 0.89, alpha: 1).cgColor,
        NSColor(calibratedRed: 0.19, green: 0.22, blue: 0.48, alpha: 1).cgColor
    ] as CFArray,
    locations: [0, 0.42, 1]
)!

context.saveGState()
context.addEllipse(in: CGRect(x: 248, y: 248, width: 528, height: 528))
context.clip()
context.drawRadialGradient(
    orb,
    startCenter: CGPoint(x: 420, y: 620),
    startRadius: 12,
    endCenter: CGPoint(x: 512, y: 512),
    endRadius: 330,
    options: [.drawsBeforeStartLocation, .drawsAfterEndLocation]
)
context.restoreGState()

context.setStrokeColor(NSColor.white.withAlphaComponent(0.16).cgColor)
context.setLineWidth(4)
context.strokeEllipse(in: CGRect(x: 250, y: 250, width: 524, height: 524))

guard
    let cgImage = context.makeImage(),
    let png = NSBitmapImageRep(cgImage: cgImage).representation(using: .png, properties: [:])
else {
    fatalError("Unable to encode icon")
}

try png.write(to: URL(fileURLWithPath: outputPath))
