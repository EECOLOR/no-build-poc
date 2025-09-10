export type Image = {
  filename: string
  metadata: {
    width: number
    height: number
    originalFilename: string
    crop?: {
      x:number
      y: number
      width: number
      height: number
    }
    hotspot?: {
      x:number
      y: number
      width: number
      height: number
    }
  }
}
