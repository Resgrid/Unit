import { type ICacheable } from '../../cacheable';
import { BaseV4Request } from '../baseV4Request';
import { DepartmentVoiceResultData } from './departmentVoiceResultData';

export class DepartmentVoiceResult extends BaseV4Request implements ICacheable {
  public cacheKey: string = 'DepartmentVoiceResult';
  public cacheTime: number = 20160;
  public cacheSavedOn: Date | undefined = undefined;
  public cacheHitFailed: boolean = false;
  public cacheType: number = 1;

  public Data: DepartmentVoiceResultData = new DepartmentVoiceResultData();
}
