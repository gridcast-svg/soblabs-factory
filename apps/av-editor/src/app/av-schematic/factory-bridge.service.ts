import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { NgDiagramModelService, NgDiagramSelectionService, type Node, type Edge } from 'ng-diagram';
import { LibraryService } from './library-sidebar/library.service';
import { SEED_LIBRARY, type LibraryDevice } from './library-sidebar/seed-library';
import type { DeviceNodeData } from './diagram/model/interfaces';

interface LoadMessage {
  channel: 'soblabs-av-v1';
  type: 'load';
  projectId: string;
  generation: number;
  document: {
    nodes: { id: string; position: { x: number; y: number }; data: DeviceNodeData }[];
    edges: Edge[];
    library: LibraryDevice[] | null;
    bomLibrary: LibraryDevice[];
  };
}

function isLoadMessage(input: unknown): input is LoadMessage {
  if (!input || typeof input !== 'object') return false;
  const message = input as Record<string, unknown>;
  const document = message['document'];
  if (!document || typeof document !== 'object') return false;
  const doc = document as Record<string, unknown>;
  return (
    message['channel'] === 'soblabs-av-v1' &&
    message['type'] === 'load' &&
    typeof message['projectId'] === 'string' &&
    typeof message['generation'] === 'number' &&
    Number.isSafeInteger(message['generation']) &&
    Array.isArray(doc['nodes']) &&
    Array.isArray(doc['edges']) &&
    Array.isArray(doc['bomLibrary']) &&
    (doc['library'] === null || Array.isArray(doc['library']))
  );
}

/** Same-origin transport. Factory validates the document and owns persistence. */
@Injectable()
export class FactoryBridgeService {
  private readonly model = inject(NgDiagramModelService);
  private readonly library = inject(LibraryService);
  private readonly selection = inject(NgDiagramSelectionService);
  private context: { projectId: string; generation: number } | null = null;
  private loaded = false;
  private started = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private last = '';
  private fit: (() => void) | undefined;
  private pending = Promise.resolve();
  private requested = 0;

  constructor() {
    effect(() => {
      this.model.nodes();
      this.model.edges();
      this.library.devices();
      if (!this.loaded) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.publish();
      }, 0);
    });
    effect(() => {
      const selected = this.selection.selection();
      if (this.loaded)
        this.send('selection', {
          nodeId: selected.nodes[0]?.id ?? '',
          edgeId: selected.edges[0]?.id ?? '',
        });
    });
    const listener = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      const message: unknown = event.data;
      if (!isLoadMessage(message)) return;
      this.loaded = false;
      this.requested = message.generation;
      this.pending = this.pending.then(async () => {
        if (message.generation === this.requested) await this.load(message);
      });
    };
    window.addEventListener('message', listener);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', listener);
      clearTimeout(this.timer);
    });
  }

  ready(fit: () => void): void {
    this.fit = fit;
    if (this.started) return;
    this.started = true;
    this.send('ready', {});
  }

  private async load(message: LoadMessage): Promise<void> {
    this.loaded = false;
    clearTimeout(this.timer);
    const first = !this.context;
    this.context = { projectId: message.projectId, generation: message.generation };
    try {
      await this.model.deleteNodes(this.model.nodes().map((node) => node.id));
      await this.model.deleteEdges(this.model.edges().map((edge) => edge.id));
      this.library.devices.set([
        ...(message.document.bomLibrary ?? []),
        ...(message.document.library ?? SEED_LIBRARY),
      ]);
      await this.model.addNodes(
        message.document.nodes.map((node) => ({ ...node, type: 'deviceNode' })),
        { waitForMeasurements: true },
      );
      await this.model.addEdges(
        message.document.edges.map((edge) => ({ ...edge, type: 'wireEdge' })),
        { waitForMeasurements: true },
      );
      if (message.generation !== this.requested) return;
      this.loaded = true;
      this.last = '';
      if (first) this.fit?.();
      this.publish();
      this.send('loaded', {});
    } catch (error) {
      this.send('error', {
        message: error instanceof Error ? error.message : 'Unable to load drawing.',
      });
    }
  }

  nextCableId(): string {
    const used = new Set(
      this.model
        .getModel()
        .getEdges()
        .map((edge) => ((edge.data as { wireId?: string }).wireId ?? '').trim().toUpperCase()),
    );
    let n = 1;
    while (used.has(`C-${String(n).padStart(3, '0')}`)) n++;
    return `C-${String(n).padStart(3, '0')}`;
  }

  private publish(): void {
    if (!this.loaded) return;
    const nodes = this.model.nodes().map((node: Node) => ({
      id: node.id,
      position: node.position,
      data: node.data,
      ...(node.size?.width && node.size.height
        ? {
            geometry: {
              width: node.size.width,
              height: node.size.height,
              ports: (node.measuredPorts ?? []).flatMap((port) =>
                port.position && (port.side === 'left' || port.side === 'right')
                  ? [
                      {
                        id: port.id,
                        x: port.position.x + (port.side === 'right' ? (port.size?.width ?? 0) : 0),
                        y: port.position.y + (port.size?.height ?? 0) / 2,
                        side: port.side,
                      },
                    ]
                  : [],
              ),
            },
          }
        : {}),
    }));
    const edges = this.model
      .edges()
      .filter((edge) => !edge.temporary)
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourcePort: edge.sourcePort,
        target: edge.target,
        targetPort: edge.targetPort,
        sourcePosition: edge.sourcePosition,
        targetPosition: edge.targetPosition,
        routingMode: edge.routingMode,
        points: edge.points,
        data: edge.data,
      }));
    const document = { nodes, edges, library: this.library.devices() };
    const key = JSON.stringify(document);
    if (key === this.last) return;
    this.last = key;
    this.send('change', { document });
  }

  private send(type: string, data: object): void {
    window.parent.postMessage(
      { channel: 'soblabs-av-v1', type, ...this.context, ...data },
      window.location.origin,
    );
  }
}
