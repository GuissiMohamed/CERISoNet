import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private msg$ = new BehaviorSubject<string>('');
  message$ = this.msg$.asObservable();

  show(m: string) {
    this.msg$.next(m);
    setTimeout(() => this.msg$.next(''), 3000);
  }
}
