import { Component } from '@angular/core';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardComponent],
  template: '<app-dashboard></app-dashboard>',
  styles: []
})
export class AppComponent {
  title = 'spendora';
}
