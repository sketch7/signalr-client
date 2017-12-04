import { Observable } from "rxjs/Observable";
import { of } from "rxjs/observable/of";
import { first } from "rxjs/operators";

export function emptyNext(): Observable<void> {
	return of(undefined).pipe(first());
}