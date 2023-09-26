import { NoteCategoryResultData, NoteResultData } from "@resgrid/ngx-resgridlib";

export interface RolesState {
    notes: NoteResultData[];
    viewNote: NoteResultData;
    noteCategories: NoteCategoryResultData[];
}

export const initialState: RolesState = {
    notes: null,
    viewNote: null,
    noteCategories: null
};