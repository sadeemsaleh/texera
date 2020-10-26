import { Point, OperatorPredicate, OperatorLink, Breakpoint } from './workflow-common.interface';
import { LogicalPlan, BreakpointInfo } from './execute-workflow.interface';
import { SavedWorkflow } from '../service/save-workflow/save-workflow.service';


export type AddOperatorActionTrace = {
  action: 'AddOperator',
  payload: {
    addedOperator: {
      position: Point,
      operator: OperatorPredicate
    }
  }
};

export type DeleteOperatorActionTrace = {
  action: 'DeleteOperator',
  payload: {
    deletedOperator: {
      operator: OperatorPredicate
    }
  }
};

export type AddLinkActionTrace = {
  action: 'AddLink',
  payload: {
    addedLink: {
      link: OperatorLink,
      sourceOperator: OperatorPredicate,
      destinationOperator: OperatorPredicate
    }
  }
};

export type DeleteLinkActionTrace = {
  action: 'DeleteLink',
  payload: {
    deletedLink: {
      link: OperatorLink,
      sourceOperator: OperatorPredicate,
      destinationOperator: OperatorPredicate
    },
  }
};

export type ChangeOperatorPropertyActionTrace = {
  action: 'ChangeOperatorProperty',
  payload: {
    operator: OperatorPredicate,
    oldProperty: object,
    newProperty: object
  }
};

export type AddBreakpointActionTrace = {
  action: 'AddBreakpoint',
  payload: {
    operator: OperatorPredicate,
    newBreakpoint: Breakpoint
  }
};

export type ChangeBreakpointActionTrace = {
  action: 'ChangeBreakpoint',
  payload: {
    operator: OperatorPredicate,
    oldBreakpoint: Breakpoint,
    newBreakpoint: Breakpoint
  }
};

export type DeleteBreakpointActionTrace = {
  action: 'DeleteBreakpoint',
  payload: {
    operator: OperatorPredicate,
    deletedBreakpoint: Breakpoint
  }
};

export type RunWorkflowAcionTrace = {
  action: 'RunWorkflow'
};

export type RunWorkflowFailedActionTrace = {
  action: 'RunWorkflowFailed',
  payload: {
    message: Record<string, string>,
    // elapsed time since this workflow run started
    elapsedTime: number
  }
};

export type RunWorkflowCompletedActionTrace = {
  action: 'RunWorkflowCompleted',
  payload: {
    // elapsed time since this workflow run started
    elapsedTime: number
  }
};

export type PauseWorkflowActionTrace = {
  action: 'PauseWorkflow',
  payload: {
    // elapsed time since latest run / resume
    elapsedTime: number
  }
};

export type ResumeWorkflowActionTrace = {
  action: 'ResumeWorkflow',
  payload: {
    // elapsed time since latest pause
    elapsedTime: number
  }
};


export type ActionTrace =
AddOperatorActionTrace | DeleteOperatorActionTrace | AddLinkActionTrace | DeleteLinkActionTrace | ChangeOperatorPropertyActionTrace |
AddBreakpointActionTrace | ChangeBreakpointActionTrace | DeleteBreakpointActionTrace | RunWorkflowAcionTrace |
RunWorkflowFailedActionTrace | RunWorkflowCompletedActionTrace |PauseWorkflowActionTrace | ResumeWorkflowActionTrace;

export type ActionTraceRecord = {
  timestamp: number,
  actionTrace: ActionTrace,
  currentState: SavedWorkflow,
};



