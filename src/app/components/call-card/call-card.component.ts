import { Component, OnInit, Input } from '@angular/core';
import { CallPriorityResultData, CallResultData } from '@resgrid/ngx-resgridlib';

@Component({
  selector: 'app-call-card',
  templateUrl: './call-card.component.html',
  styleUrls: ['./call-card.component.scss'],
})
export class CallCardComponent implements OnInit {
  @Input() call: CallResultData;
  @Input() priority: CallPriorityResultData;
  @Input() color: string;

  constructor() {}

  ngOnInit() {}

  getColor() {
    if (!this.call) {
      return '#808080';
    } else if (this.call.CallId === '0') {
      return '#808080';
    } else if (this.priority && this.priority.Color) {
      return this.priority.Color;
    }

    return '#808080';
  }

  public invertColor(hex: string, bw: boolean): string {
    if (hex.indexOf('#') === 0) {
      hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
      throw new Error('Invalid HEX color.');
    }
    let r = parseInt(hex.slice(0, 2), 16),
      g = parseInt(hex.slice(2, 4), 16),
      b = parseInt(hex.slice(4, 6), 16);
    if (bw) {
      // https://stackoverflow.com/a/3943023/112731
      return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
    }
    // invert color components
    let r2 = (255 - r).toString(16),
      g2 = (255 - g).toString(16),
      b2 = (255 - b).toString(16);
    // pad each with zeros and return
    return (
      '#' + this.padZero(r2, 2) + this.padZero(g2, 2) + this.padZero(b2, 2)
    );
  }

  public padZero(str: string, len: number): string {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
  }
}
