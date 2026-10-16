import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import {
  NgDiagramBaseEdgeComponent,
  NgDiagramSelectionService,
  NgDiagramBaseEdgeLabelComponent,
  type Edge,
  type NgDiagramEdgeTemplate,
} from 'ng-diagram';
import { type EdgeEndpointSide } from './edge-reshaping/logic';
import { RelinkEndpointHandler } from './edge-relinking/relink-endpoint.handler';
import {
  RelinkHandleDirective,
  type RelinkPointerEvent,
} from './edge-relinking/relink-handle.directive';
import { TempEdgePointsService } from './dangling-edge-creation/temp-edge-points.service';
import { PropertiesSidebarService } from '../properties-sidebar/properties-sidebar.service';
import { type WireEdgeData } from './model/interfaces';

interface EndpointHandleView {
  id: string;
  side: EdgeEndpointSide;
  transform: string;
}

const handleTransform = (x: number, y: number, originX: number, originY: number): string =>
  `translate(${x - originX}px, ${y - originY}px) translate(-50%, -50%)`;

@Component({
  imports: [NgDiagramBaseEdgeComponent, NgDiagramBaseEdgeLabelComponent, RelinkHandleDirective],
  templateUrl: './wire-edge.component.html',
  styleUrl: './wire-edge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WireEdgeComponent implements NgDiagramEdgeTemplate<WireEdgeData> {
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly sidebar = inject(PropertiesSidebarService);
  protected selectWire(event: Event): void {
    event.stopPropagation();
    void this.selectionService.select([], [this.edge().id]).then(() => {
      this.sidebar.expandSidebar();
    });
  }

  private readonly relinkHandler = inject(RelinkEndpointHandler);
  private readonly tempEdgePoints = inject(TempEdgePointsService);

  edge = input.required<Edge<WireEdgeData>>();

  constructor() {
    // While this is the link-draw preview, publish its rendered (routed) points
    // so a drop-to-background can create a real edge with identical bends.
    effect(() => {
      const edge = this.edge();
      if (!edge.temporary) return;
      const points = edge.points;
      if (points && points.length >= 2) {
        this.tempEdgePoints.publish(edge.source, edge.sourcePort, points);
      }
    });
  }

  protected readonly strokeColor = computed(() =>
    this.edge().selected ? 'var(--av-color-accent)' : wireColor(this.edge().data.wireType ?? ''),
  );

  protected readonly shortWire = computed(() => {
    const points = this.edge().points ?? [];
    const first = points[0],
      last = points[points.length - 1];
    return !first || !last || Math.hypot(last.x - first.x, last.y - first.y) < 140;
  });

  protected readonly strokeWidth = computed(() => (this.edge().selected ? 2 : 1));

  protected readonly endpointHandles = computed<EndpointHandleView[]>(() => {
    const edge = this.edge();
    if (!edge.selected) return [];
    const points = edge.points;
    if (!points || points.length < 2) return [];
    const source = points[0];
    const target = points[points.length - 1];
    return [
      {
        id: 'endpoint-source',
        side: 'source' as const,
        transform: handleTransform(source.x, source.y, source.x, source.y),
      },
      {
        id: 'endpoint-target',
        side: 'target' as const,
        transform: handleTransform(target.x, target.y, source.x, source.y),
      },
    ];
  });

  protected onEndpointStart(event: RelinkPointerEvent, side: EdgeEndpointSide): void {
    const points = this.edge().points;
    if (!points) return;
    this.relinkHandler.onEndpointStart(this.edge().id, side, points, event.pointerId);
  }

  protected onEndpointContinue(event: RelinkPointerEvent): void {
    this.relinkHandler.onEndpointContinue(event.clientX, event.clientY, event.pointerId);
  }

  protected onEndpointEnd(event: RelinkPointerEvent): void {
    this.relinkHandler.onEndpointEnd(event.clientX, event.clientY, event.pointerId);
  }
}

function wireColor(type: string): string {
  if (/power|mains|iec|240v|120v/i.test(type)) return '#c44747';
  if (/fiber|fibre|optical/i.test(type)) return '#b56a19';
  if (/audio|xlr|dante|speaker/i.test(type)) return '#a347a1';
  if (/hdmi|displayport|sdi|video/i.test(type)) return '#536bce';
  if (/rj45|cat[5678]|ethernet|network/i.test(type)) return '#278078';
  return 'var(--av-color-wire-stroke)';
}
