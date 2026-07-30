declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats?(): Promise<string[]>;
}
