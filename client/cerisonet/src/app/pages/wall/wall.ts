import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-wall',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wall.html',
  styleUrl: './wall.css'
})
export class WallComponent implements OnInit {
  user: any = null;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.me().subscribe({
      next: (r: any) => (this.user = r.user),
      error: () => this.router.navigate(['/'])
    });
  }
}
