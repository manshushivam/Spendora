import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { LucideAngularModule, Upload, TrendingUp, TrendingDown, Wallet, ArrowUpRight, AlertCircle, Filter, Search, Download } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    importProvidersFrom(LucideAngularModule.pick({ Upload, TrendingUp, TrendingDown, Wallet, ArrowUpRight, AlertCircle, Filter, Search, Download }))
  ]
};
