// Extract only the blank form image, excluding the sample taxpayer text in the PDF.
// Development utility: swift scripts/extract-withholding-template.swift
import PDFKit
import AppKit

let document = PDFDocument(url: URL(fileURLWithPath: "withholding-tax-certificate.pdf"))!
let page = document.page(at: 0)!.pageRef!
var resources: CGPDFDictionaryRef?
var objects: CGPDFDictionaryRef?
CGPDFDictionaryGetDictionary(page.dictionary!, "Resources", &resources)
CGPDFDictionaryGetDictionary(resources!, "XObject", &objects)
var stream: CGPDFStreamRef?
CGPDFDictionaryGetStream(objects!, "X4", &stream)
let dictionary = CGPDFStreamGetDictionary(stream!)!
var width: CGPDFInteger = 0
var height: CGPDFInteger = 0
CGPDFDictionaryGetInteger(dictionary, "Width", &width)
CGPDFDictionaryGetInteger(dictionary, "Height", &height)
var format = CGPDFDataFormat.raw
let data = CGPDFStreamCopyData(stream!, &format)!
precondition(format == .raw && CFDataGetLength(data) == width * height * 3)
let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 24,
    bytesPerRow: width * 3, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: 0),
    provider: CGDataProvider(data: data)!, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
try NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
    .write(to: URL(fileURLWithPath: "public/tax/withholding-certificate-template.png"))
