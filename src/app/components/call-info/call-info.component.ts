import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { CallPriorityResultData, CallResultData, UtilsService } from '@resgrid/ngx-resgridlib';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-call-card-info',
  templateUrl: './call-info.component.html',
  styleUrls: ['./call-info.component.scss'],
})
export class CallInfoComponent implements OnInit {
  @Input() call: CallResultData;
  @Input() priority: CallPriorityResultData;
  @Input() color: string;

  constructor(private utilsProvider: UtilsService) {}

  ngOnInit() {}

  getColor() {
    if (!this.call) {
      return 'gray';
    } else if (this.call.CallId === '0') {
      return 'gray';
    } else if (this.priority) {
      return this.priority.Color;
    }
  }

  getPriorityName() {
    if (!this.call) {
      return 'Normal';
    } else if (this.call.CallId === '0') {
      return 'Normal';
    } else if (this.priority) {
      return this.priority.Name;
    }

    return 'Normal';
  }

  public getDate(date) {
		return this.utilsProvider.getDate(date);
	}
}
