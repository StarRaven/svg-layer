export class Coordinate {
  public x;
  public y;
  constructor(x, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class PlotsData {
  private path: Coordinate[];

  constructor(startx, starty: number) {
    this.path = [];
    const c = new Coordinate(startx, starty);
    this.path.push(c);
  }

  public add(x, y: number) {
    const c = new Coordinate(x, y);
    this.path.push(c);
  }
}
