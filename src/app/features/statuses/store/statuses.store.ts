import { StatusesResultData } from '@resgrid/ngx-resgridlib';
import { StatusDestination } from "../models/statusDestination";


export interface StatusesState {
    submittingUnitStatus: StatusesResultData;
    submittingUnitStatusUnitId: string;
    submittingUnitStatusModalDisplay: number;
    submitStatusDestinations: StatusDestination[];
    submittingUnitStatusNote: string;
    submitStatusDestination: StatusDestination;
}

export const initialState: StatusesState = {
    submittingUnitStatus: null,
    submittingUnitStatusUnitId: null,
    submittingUnitStatusModalDisplay: 0,
    submitStatusDestinations: null,
    submittingUnitStatusNote: null,
    submitStatusDestination: null
};