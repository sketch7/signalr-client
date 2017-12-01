import { Observable } from "rxjs/Observable";
import { of } from "rxjs/observable/of";
import { take } from "rxjs/operators";

export function emptyNext(): Observable<null> {
	return of(null).pipe(take(1));
}
