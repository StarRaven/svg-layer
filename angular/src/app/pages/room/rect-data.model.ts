export class RectData {
  private startx: number;
  private starty: number;
  private nowx: number;
  private nowy: number;

  constructor(startx, starty, nowx, nowy: number) {
    this.startx = startx;
    this.starty = starty;
    this.nowx = nowx;
    this.nowy = nowy;
  }

  public setNow(nowx, nowy: number) {
    this.nowx = nowx;
    this.nowy = nowy;
  }

  public getStartx(): number {
    return this.startx;
  }

  public getStarty(): number {
    return this.starty;
  }

  public getLTx(): number {
    return (this.startx < this.nowx ? this.startx : this.nowx)
  }

  public getLTy(): number {
    return (this.starty < this.nowy ? this.starty : this.nowy)
  }

  public getWidth(): number {
    return Math.abs(this.startx - this.nowx);
  }

  public getHeight(): number {
    return Math.abs(this.starty - this.nowy);
  }
}
