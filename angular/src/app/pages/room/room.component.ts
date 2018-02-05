import { Component, OnInit, ViewChild, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Subject, Observable, Observer } from 'rxjs';
import * as io from 'socket.io-client';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';

import { RectData } from './rect-data.model';
import { PlotsData } from './plotpath-data.model';

declare var SVG: any;
declare var fitCurve: any;

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrls: ['./room.component.scss']
})
export class RoomComponent implements OnInit {
  roomId: number;
  socket: any;

  mouseDown: boolean;
  draw: any;

  tool = 'plotpath';

  width: number;
  height: number;
  widthViewbox: number;
  heightViewbox: number;

  rects: any[] = [];
  rectsData: RectData[] = [];
  rectsRemote: any[] = [];
  rawLinesData: any[] = [];
  fittedCurves: any[] = [];
  fittedCurvesData: any[] = [];
  fittedCurvesRemote: any[] = [];
  plots: any[][]= [];
  plotsRemote: any[] = [];

  leftViewbox: number;
  topViewbox: number;

  @ViewChild('wrapper')
  wrapperRef: ElementRef;

  constructor(private route: ActivatedRoute,
    private sanitizer: DomSanitizer) {
  }

  // listen if the browser closed or refreshed
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHander(event) {
    this.socket.emit('room/leave');
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.width = this.wrapperRef.nativeElement.clientWidth;
    this.height = this.wrapperRef.nativeElement.clientHeight;
    this.draw.size(this.width, this.height);
  }

  transformX(x: number): number {
    const ratiox = this.width / this.widthViewbox;
    return (x / ratiox);
  }

  transformY(y: number): number {
    const ratioy = this.height / this.heightViewbox;
    return (y  / ratioy);
  }
  // getComputedStyle().width
  transformViewboxToSVGX(x: number): number {
    const ratiox = this.width / this.widthViewbox;
    return (x * ratiox);
  }
  transformViewboxToSVGY(y: number): number {
    const ratioy = this.height / this.heightViewbox;
    return (y * ratioy);
  }

  resetMouse() {
    this.mouseDown = false;
  }

  ngAfterViewInit() {
    const wrapperNE = this.wrapperRef.nativeElement;
    const mouseDown$ = Observable.fromEvent<MouseEvent>(wrapperNE, 'mousedown');
    const mouseUp$ = Observable.fromEvent<MouseEvent>(wrapperNE, 'mouseup');
    const mouseMove$ = Observable.fromEvent<MouseEvent>(wrapperNE, 'mousemove').bufferTime(10);

    // mouseDown
    mouseDown$.subscribe(event => {
      this.mouseDown = true;
      switch (this.tool) {
        case 'rect':
          this.initLocalRect(this.transformX(event.offsetX), this.transformY(event.offsetY));
          this.socket.emit('drawing', {
            event: 'mouseDown',
            startx: this.transformX(event.offsetX),
            starty: this.transformY(event.offsetY),
            type: 'rect'
          });
          break;
        case 'path':
          this.rawLinesData.push([]);
          this.socket.emit('drawing', {
            event: 'mouseDown',
            type: 'path'
          });
          break;
        case 'plotpath':
          this.initLocalPlotpath(this.transformX(event.offsetX), this.transformY(event.offsetY));
          this.socket.emit('drawing', {
            event: 'mouseDown',
            startx: this.transformX(event.offsetX),
            starty: this.transformY(event.offsetY),
            type: 'plotpath'
          });
          break;
      }
    });

    // mouseMove
    mouseDown$
      .map(evt => mouseMove$.takeUntil(mouseUp$))
      .concatAll()
      .subscribe({
        next: (events) => {
            switch (this.tool) {
              case 'rect':
                for (const event of events) {
                  const rect = this.rects[this.rects.length - 1];
                  const rectd = this.rectsData[this.rectsData.length - 1];
                  this.rectsData[this.rectsData.length - 1].setNow(this.transformX(event.offsetX), this.transformY(event.offsetY));
                  rect.move(rectd.getLTx(), rectd.getLTy());
                  rect.size(rectd.getWidth(), rectd.getHeight());
                  this.socket.emit('drawing', {
                    event: 'mouseMove',
                    startx: rectd.getStartx(),
                    starty: rectd.getStarty(),
                    nowx: this.transformX(event.offsetX),
                    nowy: this.transformY(event.offsetY),
                    type: 'rect'
                  });
                }
                break;
              case 'path':
                for (const event of events) {
                  this.rawLinesData[this.rawLinesData.length - 1].push([this.transformX(event.clientX) - this.leftViewbox,
                    this.transformY(event.clientY) - this.topViewbox]);
                  this.updateLines();
                }
                break;
              case 'plotpath':
                for (const event of events) {
                  const plot = this.plots[this.plots.length - 1];
                  const newplot = this.draw.circle(3).move(this.transformX(event.offsetX), this.transformY(event.offsetY)).attr({
                    'fill': '#f06'
                  });
                  plot.push(newplot);
                  this.socket.emit('drawing', {
                    event: 'mouseMove',
                    nowx: this.transformX(event.offsetX),
                    nowy: this.transformY(event.offsetY),
                    type: 'plotpath'
                  });
                }
                break;
            }
        },
        error: (err) => {
          console.error('Error: ' + err);
        },
        complete: () => {
          console.log('Complete');
          this.mouseDown = false;
        }
      });

    mouseUp$.subscribe(event => {
      this.mouseDown = false;
      this.socket.emit('drawing', {
        event: 'mouseUp'
      });
    });

  }

  fittedCurveDataToPathString(fittedLineData) {
    let str = '';
    fittedLineData.map(function (bezier, i) {
      if (i === 0) {
        str += 'M ' + bezier[0][0] + ' ' + bezier[0][1];
      }
      str += 'C ' + bezier[1][0] + ' ' + bezier[1][1] + ', ' +
        bezier[2][0] + ' ' + bezier[2][1] + ', ' +
        bezier[3][0] + ' ' + bezier[3][1] + ' ';
    });
    return str;
  }

  // updateLines(updateAllCurves) {
  updateLines() {
    this.rawLinesData.forEach((lineData, i) => {
      const isLastItem = i === this.rawLinesData.length - 1;
      // if (updateAllCurves || isLastItem) {
      if (isLastItem) {
        if (this.fittedCurves.length <= i) {
          const path = this.draw.path();
          path.fill('none');
          path.stroke({ color: '#f06', width: 4, linecap: 'round', linejoin: 'round' });
          this.fittedCurves.push(path);
        }
        if (lineData.length > 1) {
          this.fittedCurvesData[i] = fitCurve(lineData, 50);
          const str = this.fittedCurveDataToPathString(this.fittedCurvesData[i]);
          this.fittedCurves[i].plot(str).dmove(this.leftViewbox, this.topViewbox);
          this.socket.emit('drawing', {
            event: 'mouseMove',
            data: str,
            type: 'path'
          });
        }
      }
    });
  }

  updateRemotePath(pathString) {
    const i = this.fittedCurvesRemote.length - 1;
    this.fittedCurvesRemote[i].plot(pathString).dmove(this.leftViewbox, this.topViewbox);
  }

  updateRemoteRect(startx, starty, nowx, nowy) {
    const rect = this.rectsRemote[this.rectsRemote.length - 1];
    const rectd = new RectData(startx, starty, nowx, nowy);

    console.log(rectd);
    rect.move(rectd.getLTx(), rectd.getLTy());
    rect.size(rectd.getWidth(), rectd.getHeight());
  }

  initLocalPlotpath(startx, starty) {
    const plot = this.draw.circle(3).move(startx, starty).attr({
      'fill': '#f06'
    });
    this.plots.push([plot]);
  }

  initLocalRect(startx, starty) {
    const rect = this.draw.rect(0, 0).move(startx, starty).attr({
      'fill': null
      , 'fill-opacity': 0
      , stroke: '#f06'
      , 'stroke-width': 3
    });
    this.rects.push(rect);

    const rectd = new RectData(startx, starty, startx, starty);
    this.rectsData.push(rectd);
  }

  initRemoteRect(startx, starty) {
    const rect = this.draw.rect(0, 0).move(startx, starty).attr({
      'fill': null
      , 'fill-opacity': 0
      , stroke: '#FFF250'
      , 'stroke-width': 3
    });
    this.rectsRemote.push(rect);
  }

  initRemotePath() {
    const path = this.draw.path();
    path.fill('none');
    path.stroke({ color: '#FFF250', width: 4, linecap: 'round', linejoin: 'round' });
    this.fittedCurvesRemote.push(path);
  }

  handleRemoteDown(message) {
    switch (message.type) {
      case 'path':
        this.initRemotePath();
        break;
      case 'rect':
        this.initRemoteRect(message.startx, message.starty);
        break;
    }
  }

  handleRemoteMove(message) {
    switch (message.type) {
      case 'path':
        this.updateRemotePath(message.data);
        break;
      case 'rect':
        this.updateRemoteRect(message.startx, message.starty, message.nowx, message.nowy);
        break;
    }
  }

  handleRemoteUp(message) {
    switch (message.type) {
      case 'path':
        break;
      case 'rect':
        break;
    }
  }

  handleRemoteMsg(message) {
    switch (message.event) {
      case 'mouseDown':
        this.handleRemoteDown(message);
        break;
      case 'mouseMove':
        this.handleRemoteMove(message);
        break;
      case 'mouseUp':
        this.handleRemoteUp(message);
        break;
    }
  }

  getRemoteMsg() {
    this.socket.on('drawing', (data) => {
      this.handleRemoteMsg(data);
    });
  }

  initComponent() {
    this.width = this.wrapperRef.nativeElement.scrollWidth;
    this.height = this.wrapperRef.nativeElement.scrollHeight;

    this.draw = SVG('drawing').size(this.width, this.height);
    this.draw.viewbox(0, 0, 400, 300);
    this.draw.attr('preserveAspectRatio', 'none');

    this.leftViewbox = 0;
    this.topViewbox = 0;
    this.widthViewbox = 400;
    this.heightViewbox = 300;
  }

  ngOnInit() {
    this.socket = io('http://localhost:4201');
    this.route.params.subscribe((params) => {
      this.roomId = params['id'];
      this.socket.emit('room/enter', { room: this.roomId });
    });

    this.initComponent();
    this.getRemoteMsg();
  }
}
