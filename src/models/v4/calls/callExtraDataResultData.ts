import { CallPriorityResultData } from "../callPriorities/callPriorityResultData";
import { CallProtocolsResultData } from "../callProtocols/callProtocolsResultData";
import { DispatchedEventResultData } from "./dispatchedEventResultData";

export class CallExtraDataResultData {
    public CallFormData: string = '';
    public Activity: DispatchedEventResultData[] = []; 
    public Dispatches: DispatchedEventResultData[] = [];
    public Priority: CallPriorityResultData = new CallPriorityResultData();
    public Protocols: CallProtocolsResultData[] = [];
}