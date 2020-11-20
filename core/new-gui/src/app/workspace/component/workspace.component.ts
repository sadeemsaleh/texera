import { ValidationWorkflowService } from './../service/validation/validation-workflow.service';
import { ExecuteWorkflowService } from './../service/execute-workflow/execute-workflow.service';
import { DragDropService } from './../service/drag-drop/drag-drop.service';
import { WorkflowUtilService } from './../service/workflow-graph/util/workflow-util.service';
import { WorkflowActionService } from './../service/workflow-graph/model/workflow-action.service';
import { UndoRedoService } from './../service/undo-redo/undo-redo.service';
import { Component, ViewChild, HostListener, } from '@angular/core';

import { NzResizeEvent } from 'ng-zorro-antd/resizable';
import { OperatorMetadataService } from '../service/operator-metadata/operator-metadata.service';
import { JointUIService } from '../service/joint-ui/joint-ui.service';
import { StubOperatorMetadataService } from '../service/operator-metadata/stub-operator-metadata.service';
import { DynamicSchemaService } from '../service/dynamic-schema/dynamic-schema.service';
import { SourceTablesService } from '../service/dynamic-schema/source-tables/source-tables.service';
import { SchemaPropagationService } from '../service/dynamic-schema/schema-propagation/schema-propagation.service';
import { ResultPanelToggleService } from '../service/result-panel-toggle/result-panel-toggle.service';
import { SaveWorkflowService } from '../service/save-workflow/save-workflow.service';
import { WorkflowStatusService } from '../service/workflow-status/workflow-status.service';
import { WorkflowWebsocketService } from '../service/workflow-websocket/workflow-websocket.service';
import { WorkflowEditorComponent } from './workflow-editor/workflow-editor.component';

@Component({
  selector: 'texera-workspace',
  templateUrl: './workspace.component.html',
  styleUrls: ['./workspace.component.scss'],
  providers: [
    // uncomment this line for manual testing without opening backend server
    // { provide: OperatorMetadataService, useClass: StubOperatorMetadataService },
    OperatorMetadataService,
    DynamicSchemaService,
    SourceTablesService,
    SchemaPropagationService,
    JointUIService,
    WorkflowActionService,
    WorkflowUtilService,
    DragDropService,
    ExecuteWorkflowService,
    UndoRedoService,
    ResultPanelToggleService,
    SaveWorkflowService,
    ValidationWorkflowService,
    WorkflowStatusService,
    WorkflowWebsocketService,
  ]
})
export class WorkspaceComponent {

  public showResultPanel: boolean = false;
  operator_panel_width: number = window.innerWidth * 0.14;
  property_panel_width: number = window.innerWidth * 0.16;
  contentHeight: number = 25;
  workflowHeight: number = window.innerHeight - 90;
  header: number = 64;
  previousHeight: number = 25;
  id = -1;
  isLeftCollapsed: boolean = false;
  isRightCollapsed: boolean = false;
  @ViewChild(WorkflowEditorComponent)
  workflowComponent!: WorkflowEditorComponent;

  constructor(
    private resultPanelToggleService: ResultPanelToggleService,

    // list additional services in constructor so they are initialized even if no one use them directly
    private sourceTablesService: SourceTablesService,
    private schemaPropagationService: SchemaPropagationService,
    private saveWorkflowService: SaveWorkflowService,
    private workflowWebsocketService: WorkflowWebsocketService,
  ) {
    this.resultPanelToggleService.getToggleChangeStream().subscribe(
      value => this.showResultPanel = value,
    );
  }

    onSideResize({ width }: NzResizeEvent): void {
      cancelAnimationFrame(this.id);
      this.id = requestAnimationFrame(() => {
        this.operator_panel_width = width!;
        this.workflowComponent.setJointPaperDimensions();
      });
    }

    onSideResize2({ width }: NzResizeEvent): void {
      cancelAnimationFrame(this.id);
      this.id = requestAnimationFrame(() => {
        this.property_panel_width = width!;
        this.workflowComponent.setJointPaperDimensions();
      });
    }

    onSideCollapse(): void {
      // setTimeout, wait to get latest dimension
      setTimeout( () => {
        this.workflowComponent.setJointPaperDimensions();
      }, 180);
    }


    onContentResize({ height }: NzResizeEvent): void {
      cancelAnimationFrame(this.id);
      this.id = requestAnimationFrame(() => {
        this.contentHeight = height!;
        this.previousHeight = this.contentHeight;
        this.workflowHeight = window.innerHeight - this.contentHeight - this.header;
        this.workflowComponent.setJointPaperDimensions2(this.workflowHeight);
      });
    }

    updateHeight() {
      if (!this.showResultPanel) {
        this.contentHeight = 25;
      } else {
        if (this.previousHeight !== 25) {
        // recover to previous height
          this.contentHeight = this.previousHeight;
        } else {
          // default height
          this.contentHeight = (window.innerHeight - this.header) * 0.35;
        }
      }
      this.workflowHeight = window.innerHeight - this.contentHeight - this.header;
      this.workflowComponent.setJointPaperDimensions2(this.workflowHeight);
    }

    getUpdatedHeight() {
      if (this.previousHeight !== 25) {
        this.contentHeight = this.previousHeight;
      } else {
        this.contentHeight = (window.innerHeight - this.header) * 0.35;
      }
      this.workflowHeight = window.innerHeight - this.contentHeight - this.header;
      this.workflowComponent.setJointPaperDimensions2(this.workflowHeight);
    }
}
