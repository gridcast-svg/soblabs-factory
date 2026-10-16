import { DestroyRef, Injectable, inject } from '@angular/core';
import { NgDiagramModelService, NgDiagramViewportService } from 'ng-diagram';
import { NodeVisibilityConfigService } from './node-visibility/node-visibility-config.service';

/** Desktop overview framing without enlarging a small system to fill the monitor. */
@Injectable()
export class CanvasViewService {
  private readonly model = inject(NgDiagramModelService);
  private readonly viewport = inject(NgDiagramViewportService);
  private readonly visibility = inject(NodeVisibilityConfigService);
  private element?: HTMLElement;
  private initialized = false;
  private pending = 0;

  attach(element: HTMLElement): void {
    this.element = element;
    const observer = new ResizeObserver(() => {
      if (!this.initialized) return;
      cancelAnimationFrame(this.pending);
      this.pending = requestAnimationFrame(() => {
        this.fit();
      });
    });
    observer.observe(element);
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(this.pending);
    });
  }

  private visibleArea() {
    const rect = this.element?.getBoundingClientRect();
    if (!rect) return null;
    const inset = this.visibility.getViewportInsets();
    const left = (inset.left ?? 0) + 40;
    const top = (inset.top ?? 0) + 40;
    return {
      left,
      top,
      width: Math.max(1, rect.width - left - (inset.right ?? 0) - 40),
      height: Math.max(1, rect.height - top - (inset.bottom ?? 0) - 40),
    };
  }

  fit(): void {
    const area = this.visibleArea();
    if (!area || !this.model.nodes().length) return;
    const bounds = this.model.computePartsBounds(this.model.nodes(), this.model.edges());
    const scale = Math.max(
      this.viewport.minZoom,
      Math.min(
        0.85,
        area.width / Math.max(1, bounds.width),
        area.height / Math.max(1, bounds.height),
      ),
    );
    this.initialized = true;
    void this.viewport.setViewport(
      area.left + area.width / 2 - (bounds.x + bounds.width / 2) * scale,
      area.top + area.height / 2 - (bounds.y + bounds.height / 2) * scale,
      scale,
    );
  }

  actualSize(): void {
    const area = this.visibleArea();
    if (!area) return;
    const current = this.viewport.viewport();
    const x = area.left + area.width / 2;
    const y = area.top + area.height / 2;
    void this.viewport.setViewport(
      x - (x - current.x) / current.scale,
      y - (y - current.y) / current.scale,
      1,
    );
  }
}
