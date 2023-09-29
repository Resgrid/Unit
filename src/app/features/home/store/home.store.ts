import { CallPriorityResultData, CallResultData, CallTypeResultData, DepartmentRightsResult, GetConfigResultData, GroupResultData, MapDataAndMarkersData, UnitResultData, UnitStatusResultData, UnitTypeStatusResultData } from '@resgrid/ngx-resgridlib';
import { GeoLocation } from "src/app/models/geoLocation";
import { PushData } from "src/app/models/pushData";

export interface HomeState {
    mapData: MapDataAndMarkersData;
    mapDataTimestamp: string;

    currentPositionTimestamp: Date;
    currentPosition: GeoLocation;
    
    activeUnit: UnitResultData;
    activeCall: CallResultData;
    activePriority: CallPriorityResultData;
    activeStatuses: UnitTypeStatusResultData;

    currentStatus: UnitStatusResultData;
    //roles: UnitRoleResultData[];

    pushData: PushData;

    // App Data
    isMobileApp: boolean;
    units: UnitResultData[];
    calls: CallResultData[];
    callPriorties: CallPriorityResultData[];
    callTypes: CallTypeResultData[];
    unitStatuses: UnitTypeStatusResultData[];
    //unitRoleAssignments: ActiveUnitRoleResultData[];
    groups: GroupResultData[];
    config: GetConfigResultData;
    rights: DepartmentRightsResult;
}

export const initialState: HomeState = {
    mapData: null,
    currentPosition: null,
    activeUnit: null,
    activeCall: null,
    activeStatuses: new UnitTypeStatusResultData(),
    activePriority: new CallPriorityResultData(),
    units: [],
    calls: [],
    callPriorties: [],
    callTypes: [],
    unitStatuses: [],
    //unitRoleAssignments: [],
    groups: [],
    currentStatus: null,
    currentPositionTimestamp: null,
    mapDataTimestamp: null,
    pushData: null,
    //roles: [],
    isMobileApp: false,
    rights: null,
    config: null,
};
