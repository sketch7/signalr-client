import { Observable, of } from "rxjs";

export function emptyNext(): Observable<void> {
	return of(undefined);
}