import { Injectable } from '@angular/core';
import * as automerge from 'automerge';
import { Observable } from '../../../../../node_modules/rxjs';
import { OperatorLink, OperatorPredicate, Point } from '../../types/workflow-common.interface';
import { OperatorMetadataService } from '../operator-metadata/operator-metadata.service';
import { webSocket } from 'rxjs/webSocket';
import { CommandMessage, WorkflowActionService} from '../workflow-graph/model/workflow-action.service';
import { UndoRedoService } from './../undo-redo/undo-redo.service';

@Injectable({
  providedIn: 'root'
})

// This service will be for workflow collab
// First step: move the arrays from undo/redo service into Yjs doc.
// Once we have some stuff set I'll send the changes between clients and just see how to work with them.
// Need to find a way to push as part of change, not update like that


// Giving up on automerge
// This solution doesn't actually work, doesn't save the modifications to the array as part of the change
// Let's try yjs. For yjs need to encode Uint8Array as a string properly
// Found a way to convert, just need to do it back once we get it on the other client
// In order to sync them up


export class WorkflowCollabService {

//  private doc1 = new Y.Doc();
//  private doc2 = new Y.Doc();

  public functionMap: {[key: string]: Function} = {};

  private testScript: boolean = false;
  private sendData: boolean = true;

  private workflowAction: WorkflowActionService | undefined;
  private undoRedo: UndoRedoService | undefined;

  private socket = webSocket({
    url: 'ws://localhost:1234/automerge',
  });

  constructor(
    private operatorMetadataService: OperatorMetadataService
  ) {
    const self = this;
    // this.handleAutoSaveWorkFlow();


    this.socket.subscribe({
      next(response) {
        console.log('Message received!');
        console.log(response);
        /** */
        if (response.hasOwnProperty('response')) {
          console.log(JSON.parse(response['response']));
          self.handleMessage(response['response']);
        }
     },
      error(err) {
        console.log('problem');
        console.log(JSON.stringify(err));
        throw new Error(err);
      },
      complete() {
        console.log('websocket finished and disconnected');
      }
    });
 }


  public setSendData(toggle: boolean): void {
    this.sendData = toggle;
  }

  public getSendData(): boolean {
    return this.sendData;
  }

  public sendCommand(update: string): void {
    console.log(JSON.parse(update));
    this.socket.next(update);
  }

  public setFunctionMap(command: string, func: Function): void {
    this.functionMap[command] = func;
  }

  public handleMessage(update: string): void {
    const opMessage: CommandMessage = JSON.parse(update);
    this.setSendData(false);
    console.log(opMessage);
    // This map isn't really working, maybe try having a copy of the service here? Idk how it'll work though.
    // this.functionMap[opMessage.operation](opMessage.operatorPositions, opMessage.links);
    if (this.workflowAction && this.undoRedo) {
      if (opMessage.action === 'execute') {
        if (opMessage.operation === 'addOpsLinks') {
          this.workflowAction.addOperatorsAndLinks(opMessage.operatorPositions, opMessage.links);
        } else if (opMessage.operation === 'delete') {
          this.workflowAction.deleteOperator(opMessage.operators[0].operatorID);
        } else if (opMessage.operation === 'changeProperty') {
          this.workflowAction.setOperatorProperty(opMessage.operators[0].operatorID, opMessage.newProperty);
        }
      } else if (opMessage.action === 'undo') {
        this.undoRedo.undoAction();
      } else if (opMessage.action === 'redo') {
        this.undoRedo.redoAction();
      }
    }
    this.setSendData(true);
  }

  public setServices(workflowActionService: WorkflowActionService, undoRedoService: UndoRedoService): void {
    this.workflowAction = workflowActionService;
    this.undoRedo = undoRedoService;
  }


  private stringtoUpdate(update: string): Uint8Array {
    const parsed = update.toString().split(',');
    // console.log(parsed);
    const output = new Uint8Array(parsed.length);
    for (let i = 0; i < parsed.length; i++) {
      // tslint:disable-next-line:radix
      output[i] = parseInt(parsed[i]);
    }
    return output;
  }


  private getWorkflowAction(): WorkflowActionService | undefined {
    return this.workflowAction;
  }


// SET ALL THIS ASIDE

/**
  public addCommand(command: Command): void {
    const tempUndo = this.obj.undoStack;
    tempUndo.push(command);
    const newObj = automerge.change(this.obj, 'add', doc => {
      doc.undoStack = tempUndo;
      doc.redoStack = [];
    });
    const changes = automerge.getChanges(this.obj, newObj);
    this.obj = automerge.applyChanges(this.obj, changes);
    // this.socket.next(JSON.stringify(changes));

    const initialData = automerge.save(this.obj);
    // this.socket.next('changeInitial' + initialData);
    console.log(this.obj);
    console.log(automerge.load(initialData));


    // Yjs test
    if (this.testScript) {
      this.doc1.getArray('undo').push([command]);
      this.doc1.getArray('undo').push([command]);
      this.doc1.getArray('undo').push([command]);
      console.log(this.doc1.getArray('undo').length);
      console.log(this.doc2.getArray('undo').length);

      const update = Y.encodeStateAsUpdate(this.doc1);
      const testUpdate = this.stringtoUpdate(update.toString());
      Y.applyUpdate(this.doc2, update);
      console.log(this.doc1.getArray('undo').length);
      console.log(this.doc2.getArray('undo').length);

      // Check if command is stored properly, also need to try executing using Ydoc
      console.log(this.doc1.getArray('undo').get(0));
      console.log(this.doc2.getArray('undo').get(0));
      console.log(command);
      console.log(typeof(command));

      this.doc1.getArray('undo').delete(0, this.doc1.getArray('undo').length);
      const newUpdate = Y.encodeStateAsUpdate(this.doc1);
      Y.applyUpdate(this.doc2, newUpdate);
      console.log(this.doc1.getArray('undo').length);
      console.log(this.doc2.getArray('undo').length);

      // Seems to work? Now need to setup
    }
  }

  public undoAction(): void {
    const len = this.obj.undoStack.length;
    if (len > 0) {
      const tempUndo = this.obj.undoStack;
      const tempRedo = this.obj.redoStack;
      const command = tempUndo.pop();
      if (command) {
        command.undo();
        tempRedo.push(command);
        const newObj = automerge.change(this.obj, 'undo', doc => {
          doc.undoStack = tempUndo;
          doc.redoStack = tempRedo;
          doc.changeDetector *= -1;
        });
        const changes = automerge.getChanges(this.obj, newObj);
        this.obj = automerge.applyChanges(this.obj, changes);
        const initialData = automerge.save(this.obj);
        // this.socket.next('changeInitial' + initialData);
      }
    }
  }


  public redoAction(): void {
    if (this.obj.redoStack.length > 0) {
      const tempUndo = this.obj.undoStack;
      const tempRedo = this.obj.redoStack;
      const command = tempRedo.pop();
      if (command) {
        if (command.redo) {
          command.redo();
        } else {
          command.execute();
        }
        tempUndo.push(command);
        const newObj = automerge.change(this.obj, 'redo', doc => {
          doc.undoStack = tempUndo;
          doc.redoStack = tempRedo;
        });
        const changes = automerge.getChanges(this.obj, newObj);
        this.obj = automerge.applyChanges(this.obj, changes);
        const initialData = automerge.save(this.obj);
        // this.socket.next('changeInitial' + initialData);
      }
    }
  }

  // Might not need these initialize functions with Yjs, try and see
  // Actually, I still want it on the main server
  // When we get initial data, just need to EXECUTE() all the commands in the undo stack
  public initializeAndSend() {
    // this.socket.next('changeInitial' + automerge.save(this.obj));
  }

  public initializeFromServer(newDoc: string) {
    this.obj = automerge.load(newDoc);
    console.log(this.obj);
  }

  private stringtoUpdate(update: String): Uint8Array {
    const parsed = update.toString().split(',');
    // console.log(parsed);
    const output = new Uint8Array(parsed.length);
    for (let i = 0; i < parsed.length; i++) {
      // tslint:disable-next-line:radix
      output[i] = parseInt(parsed[i]);
    }
    return output;
  }
 */

  // THIS BLOCK DOWN HERE FOR SENDING ENTIRE WORKFLOW

  /**
  public handleAutoSaveWorkFlow(): void {
  Observable.merge(
    this.workflowActionService.getTexeraGraph().getOperatorAddStream(),
    this.workflowActionService.getTexeraGraph().getOperatorDeleteStream(),
    this.workflowActionService.getTexeraGraph().getLinkAddStream(),
    this.workflowActionService.getTexeraGraph().getLinkDeleteStream(),
    this.workflowActionService.getTexeraGraph().getOperatorPropertyChangeStream(),
    this.workflowActionService.getTexeraGraph().getOperatorAdvancedOptionChangeSteam(),
    this.workflowActionService.getJointGraphWrapper().getOperatorPositionChangeEvent()
  ).debounceTime(100).subscribe(() => {
    const workflow = this.workflowActionService.getTexeraGraph();

    const operators = workflow.getAllOperators();
    const links = workflow.getAllLinks();
    const operatorPositions: {[key: string]: Point} = {};
    workflow.getAllOperators().forEach(op => operatorPositions[op.operatorID] =
      this.workflowActionService.getJointGraphWrapper().getOperatorPosition(op.operatorID));


    const savedWorkflow: SavedWorkflow = {
      operators, operatorPositions, links
    };
    const sendDoc = new Y.Doc();
    sendDoc.getArray('savedworkflow').push([JSON.stringify(savedWorkflow)]);

    const updateToSend = Y.encodeStateAsUpdate(sendDoc);
    if (this.sendData) {
      this.socket.next(updateToSend.toString());
      this.socket.next('changeInitial' + updateToSend);
    }

    this.sendData = true;
    });
  }
  public loadFromDoc(update: String): void {
    const updateToApply = this.stringtoUpdate(update);
    const updateDoc = new Y.Doc();
    Y.applyUpdate(updateDoc, updateToApply);

    const workflowString = updateDoc.getArray('savedworkflow').get(0);
    if (typeof(workflowString) === 'string') {
      this.workflowActionService.deleteOperatorsAndLinks(
        this.workflowActionService.getTexeraGraph().getAllOperators().map(op => op.operatorID), []);

      const savedWorkflow: SavedWorkflow = JSON.parse(workflowString);
      this.sendData = false;
      console.log(savedWorkflow.operators);
      console.log(savedWorkflow.links);
      console.log(savedWorkflow.operatorPositions);
      const operatorsAndPositions: {op: OperatorPredicate, pos: Point}[] = [];
      savedWorkflow.operators.forEach(op => {
        const opPosition = savedWorkflow.operatorPositions[op.operatorID];
        if (! opPosition) {
          throw new Error('position error');
        }
        operatorsAndPositions.push({op: op, pos: opPosition});
      });

      const links: OperatorLink[] = [];
      savedWorkflow.links.forEach(link => {
        links.push(link);
      });

      this.workflowActionService.addOperatorsAndLinks(operatorsAndPositions, links);

      this.workflowActionService.getJointGraphWrapper().unhighlightOperators(
        this.workflowActionService.getJointGraphWrapper().getCurrentHighlightedOperatorIDs());
    }
  }
  */
}
