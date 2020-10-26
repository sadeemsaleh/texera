import { Injectable } from '@angular/core';
import { WorkflowActionService } from '../workflow-graph/model/workflow-action.service';
import { ExecuteWorkflowService } from '../execute-workflow/execute-workflow.service';
import {
  ActionTraceRecord, AddOperatorActionTrace, ActionTrace, DeleteOperatorActionTrace, AddLinkActionTrace,
   DeleteLinkActionTrace, ChangeOperatorPropertyActionTrace, AddBreakpointActionTrace, DeleteBreakpointActionTrace,
   ChangeBreakpointActionTrace, RunWorkflowAcionTrace, RunWorkflowFailedActionTrace, RunWorkflowCompletedActionTrace,
   PauseWorkflowActionTrace, ResumeWorkflowActionTrace } from '../../types/action-trace.interface';
import { SaveWorkflowService } from '../save-workflow/save-workflow.service';
import { ExecutionState } from '../../types/execute-workflow.interface';

@Injectable({
  providedIn: 'root'
})
export class ActionTraceService {

  private startTrace: boolean = false;

  private actionTraceHistory: ActionTraceRecord[] = [];

  private lastRunWorkflowStartTime: number | undefined;
  private lastResumeWorkflowStartTime: number | undefined;
  private lastPauseWorkflowStartTime: number | undefined;

  constructor(
    private workflowActionService: WorkflowActionService,
    private executeWorkflowService: ExecuteWorkflowService
  ) {
    const graph = workflowActionService.getTexeraGraph();
    const joint = workflowActionService.getJointGraphWrapper();

    graph.getOperatorAddStream().filter(e => this.startTrace).subscribe(event => {
      const actionTrace: AddOperatorActionTrace = {
        action: 'AddOperator',
        payload: {
          addedOperator: {
            position: joint.getOperatorPosition(event.operatorID),
            operator: event
          }
        }
      };
      this.addActionTrace(actionTrace);
    });

    graph.getOperatorDeleteStream().filter(e => this.startTrace).subscribe(event => {
      const actionTrace: DeleteOperatorActionTrace = {
        action: 'DeleteOperator',
        payload: {
          deletedOperator: {
            operator: event.deletedOperator
          }
        }
      };
      this.addActionTrace(actionTrace);
    });

    graph.getLinkAddStream().filter(e => this.startTrace).subscribe(event => {
      const actionTrace: AddLinkActionTrace = {
        action: 'AddLink',
        payload: {
          addedLink: {
            link: event,
            sourceOperator: graph.getOperator(event.source.operatorID),
            destinationOperator: graph.getOperator(event.target.operatorID)
          }
        }
      };
      this.addActionTrace(actionTrace);
    });

    graph.getLinkDeleteStream().filter(e => this.startTrace).subscribe(event => {
      const actionTrace: DeleteLinkActionTrace = {
        action: 'DeleteLink',
        payload: {
          deletedLink: {
            link: event.deletedLink,
            sourceOperator: graph.getOperator(event.deletedLink.source.operatorID),
            destinationOperator: graph.getOperator(event.deletedLink.target.operatorID)
          }
        }
      };
      this.addActionTrace(actionTrace);
    });

    graph.getOperatorPropertyChangeStream().filter(e => this.startTrace).subscribe(event => {
      const actionTrace: ChangeOperatorPropertyActionTrace = {
        action: 'ChangeOperatorProperty',
        payload: {
          operator: event.operator,
          oldProperty: event.oldProperty,
          newProperty: event.operator.operatorProperties
        }
      };
      this.addActionTrace(actionTrace);
    });

    graph.getBreakpointChangeStream().filter(e => this.startTrace).subscribe(event => {
      const currentBreakpoint = graph.getLinkBreakpoint(event.linkID);
      if (event.oldBreakpoint === undefined && currentBreakpoint !== undefined) {
        // add breakpoint
        const actionTrace: AddBreakpointActionTrace = {
          action: 'AddBreakpoint',
          payload: {
            operator: graph.getOperator(graph.getLinkWithID(event.linkID).source.operatorID),
            newBreakpoint: currentBreakpoint
          }
        };
        this.addActionTrace(actionTrace);
      } else if (event.oldBreakpoint !== undefined && currentBreakpoint === undefined) {
        // delete breakpoint
        const actionTrace: DeleteBreakpointActionTrace = {
          action: 'DeleteBreakpoint',
          payload: {
            operator: graph.getOperator(graph.getLinkWithID(event.linkID).source.operatorID),
            deletedBreakpoint: event.oldBreakpoint
          }
        };
        this.addActionTrace(actionTrace);
      } else if (event.oldBreakpoint !== undefined && currentBreakpoint !== undefined) {
        // change breakpoint
        const actionTrace: ChangeBreakpointActionTrace = {
          action: 'ChangeBreakpoint',
          payload: {
            operator: graph.getOperator(graph.getLinkWithID(event.linkID).source.operatorID),
            oldBreakpoint: event.oldBreakpoint,
            newBreakpoint: currentBreakpoint
          }
        };
        this.addActionTrace(actionTrace);
      }
    });

    this.executeWorkflowService.getExecutionStateStream().filter(e => this.startTrace).subscribe(event => {
      if (event.previous.state !== ExecutionState.Paused && event.current.state === ExecutionState.Running) {
        const actionTrace: RunWorkflowAcionTrace = {
          action: 'RunWorkflow'
        };
        this.addActionTrace(actionTrace);
        this.lastRunWorkflowStartTime = Date.now();
        this.lastResumeWorkflowStartTime = Date.now();
      } else if (event.current.state === ExecutionState.Failed) {
        const actionTrace: RunWorkflowFailedActionTrace = {
          action: 'RunWorkflowFailed',
          payload: {
            message: event.current.errorMessages,
            elapsedTime: this.lastRunWorkflowStartTime === undefined ? 0 : Date.now() - this.lastRunWorkflowStartTime
          }
        };
        this.addActionTrace(actionTrace);
      } else if (event.current.state === ExecutionState.Completed) {
        const actionTrace: RunWorkflowCompletedActionTrace = {
          action: 'RunWorkflowCompleted',
          payload: {
            elapsedTime: this.lastRunWorkflowStartTime === undefined ? 0 : Date.now() - this.lastRunWorkflowStartTime
          }
        };
        this.addActionTrace(actionTrace);
      } else if (event.current.state === ExecutionState.Paused) {
        const actionTrace: PauseWorkflowActionTrace = {
          action: 'PauseWorkflow',
          payload: {
            elapsedTime: this.lastResumeWorkflowStartTime === undefined ? 0 : Date.now() - this.lastResumeWorkflowStartTime
          }
        };
        this.addActionTrace(actionTrace);
        this.lastPauseWorkflowStartTime = Date.now();
      } else if (event.current.state === ExecutionState.Resuming) {
        const actionTrace: ResumeWorkflowActionTrace = {
          action: 'ResumeWorkflow',
          payload: {
            elapsedTime: this.lastPauseWorkflowStartTime === undefined ? 0 : Date.now() - this.lastPauseWorkflowStartTime
          }
        };
        this.addActionTrace(actionTrace);
        this.lastResumeWorkflowStartTime = Date.now();
      }

    });

  }

  public getActionTraceHistory(): ReadonlyArray<ActionTraceRecord> {
    return this.actionTraceHistory;
  }

  public isTraceStarted(): boolean {
    return this.startTrace;
  }

  public startActionTrace(): void {
    this.startTrace = true;
  }

  public stopActionTrace(): void {
    this.startTrace = false;
  }

  public clearActionTrace(): void {
    this.actionTraceHistory = [];
  }

  private addActionTrace(actionTrace: ActionTrace): void {
    const currentState = SaveWorkflowService.dumpSavedWorkflow(this.workflowActionService);
    const timestamp = Date.now();
    this.actionTraceHistory.push({
      timestamp, actionTrace, currentState
    });
  }


}
