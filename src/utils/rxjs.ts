import { Observable, of } from "rxjs";

export function emptyNext(): Observable<undefined> {
	return of(undefined);
}