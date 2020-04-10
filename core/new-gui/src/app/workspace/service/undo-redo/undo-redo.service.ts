import { Command } from './../workflow-graph/model/workflow-action.service';
import { WorkflowCollabService } from './../workflow-collab/workflow-collab.service';
import { Injectable } from '@angular/core';



@Injectable()
export class UndoRedoService {

  // lets us know whether to listen to the JointJS observables, most of the time we don't
  public listenJointCommand: boolean = true;
  // private testGraph: WorkflowGraphReadonly;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];


  constructor(private workflowCollab: WorkflowCollabService) { }

  public undoAction(): void {
    // We have a toggle to let our service know to add to the redo stack
    this.setListenJointCommand(false);
    this.workflowCollab.undoAction();
    this.setListenJointCommand(true);
  }

  public redoAction(): void {
    this.setListenJointCommand(false);
    this.workflowCollab.redoAction();
    this.setListenJointCommand(true);
  }

  public addCommand(command: Command): void {
    this.workflowCollab.addCommand(command);
  }

  public setListenJointCommand(toggle: boolean): void {
    this.listenJointCommand = toggle;
  }

  public getUndoLength(): number {
    return this.undoStack.length;
  }

  public getRedoLength(): number {
    return this.redoStack.length;
  }
}
