import { Command, CommandMessage } from './../workflow-graph/model/workflow-action.service';
import { Injectable } from '@angular/core';
import { WorkflowCollabService } from './../workflow-collab/workflow-collab.service';
import * as Y from 'yjs';


/* TODO LIST FOR BUGS
1. Problem with repeatedly adding and deleting a link without letting go, unintended behavior
2. See if there's a way to only store a previous version of an operator's properties
after a certain period of time so we don't undo one character at a time */

@Injectable()
export class UndoRedoService {

  // lets us know whether to listen to the JointJS observables, most of the time we don't
  public listenJointCommand: boolean = true;
  // private testGraph: WorkflowGraphReadonly;

  private testDoc = new Y.Doc();
  private doc2 = new Y.Doc();
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];


  constructor(private workflowCollabService: WorkflowCollabService) {
    this.handleRemoteChange();
  }

  public undoAction(): void {
    // We have a toggle to let our service know to add to the redo stack
    if (this.undoStack.length > 0) {
      const command = this.undoStack.pop();
      if (command) {
        this.setListenJointCommand(false);
        command.undo();
        this.redoStack.push(command);
        this.setListenJointCommand(true);
        const commandMessage: CommandMessage = {'action': 'deleteOperator', 'parameters': [''], 'type': 'undo'};
        this.sendCommand(JSON.stringify(commandMessage));
      }
    }
  }

  public redoAction(): void {
    // need to figure out what to keep on the stack and off
    if (this.redoStack.length > 0) {
      // set clearRedo to false so when we redo an action, we keep the rest of the stack
      const command = this.redoStack.pop();
      if (command) {
        this.setListenJointCommand(false);
        if (command.redo) {
          command.redo();
        } else {
          command.execute();
        }
        this.undoStack.push(command);
        const commandMessage: CommandMessage = {'action': 'deleteOperator', 'parameters': [''], 'type': 'redo'};
        this.sendCommand(JSON.stringify(commandMessage));
        this.setListenJointCommand(true);
      }
    }

  }

  public addCommand(command: Command): void {
    this.undoStack.push(command);
    this.redoStack = [];

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

  private sendCommand(update: string): void {
    if (this.workflowCollabService.getSendData()) {
      this.workflowCollabService.sendCommand(update);
    }
  }

  private handleRemoteChange(): void {
    const self = this;
    this.workflowCollabService.getCommandMessageStream().subscribe(message => {
      if (message.type === 'undo') {
        self.workflowCollabService.setSendData(false);
        self.undoAction();
        self.workflowCollabService.setSendData(true);
      } else if (message.type === 'redo') {
        self.workflowCollabService.setSendData(false);
        self.redoAction();
        self.workflowCollabService.setSendData(true);
      }
    });
  }
}
