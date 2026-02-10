import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { WallComponent } from './pages/wall/wall';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'wall', component: WallComponent },
  { path: '**', redirectTo: '' },
];
