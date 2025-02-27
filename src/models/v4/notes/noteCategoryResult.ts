import { BaseV4Request } from '../baseV4Request';
import { NoteCategoryResultData } from './noteCategoryResultData';

export class NoteCategoryResult extends BaseV4Request {
  public Data: NoteCategoryResultData[] = [];
}
