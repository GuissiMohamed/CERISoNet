import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotifyService } from '../../services/notify';


@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wall.html',
  styleUrl: './wall.css'
})
export class WallComponent implements OnInit {
  user: any = null;

constructor(
  private auth: AuthService,
  private notify: NotifyService,
  private router: Router
) {}

logout() {
  this.auth.logout().subscribe(() => {
    this.notify.show('success', 'Déconnexion réussie 👋');
    this.router.navigate(['/']);
  });
}
  ngOnInit(): void {
    this.auth.me().subscribe({
      next: (r: any) => (this.user = r.user),
      error: () => this.router.navigate(['/'])
    });
  }
}
