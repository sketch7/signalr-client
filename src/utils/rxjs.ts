import { Observable } from "rxjs/Observable";
import { of } from "rxjs/observable/of";
import { take } from "rxjs/operators";

export function emptyNext(): Observable<void> {
	return of(undefined).pipe(take(1));
}
