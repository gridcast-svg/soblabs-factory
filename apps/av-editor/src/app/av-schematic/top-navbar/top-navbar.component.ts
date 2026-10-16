import { LibraryService } from '../library-sidebar/library.service';
import { PropertiesSidebarService } from '../properties-sidebar/properties-sidebar.service';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ExportMenuComponent } from './export-menu/export-menu.component';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-top-navbar',
  imports: [ExportMenuComponent, ThemeToggleComponent],
  templateUrl: './top-navbar.component.html',
  styleUrl: './top-navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNavbarComponent {
  private readonly library = inject(LibraryService);
  private readonly properties = inject(PropertiesSidebarService);
  protected readonly panelsHidden = computed(
    () => !this.library.isExpanded() && !this.properties.isExpanded(),
  );
  private previous = { library: true, properties: false };
  protected togglePanels(): void {
    if (this.panelsHidden()) {
      this.library.isExpanded.set(this.previous.library);
      this.properties.isExpanded.set(this.previous.properties);
    } else {
      this.previous = {
        library: this.library.isExpanded(),
        properties: this.properties.isExpanded(),
      };
      this.library.isExpanded.set(false);
      this.properties.isExpanded.set(false);
    }
  }
}
