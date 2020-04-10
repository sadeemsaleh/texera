import { Injectable } from '@angular/core';
import * as automerge from 'automerge';
import { Command } from './../workflow-graph/model/workflow-action.service';
import { webSocket } from 'rxjs/webSocket';
import * as Y from 'yjs';

@Injectable({
  providedIn: 'root'
})

// This service will be for workflow collab
// First step: move the arrays from undo/redo service into this automerge object and use it instead.
// Once we have some stuff set I'll send the changes between clients and just see how to work with them.
// Need to find a way to push as part of change, not update like that


// Two bugs: cannot push command within automerge.change, need to push it into external array then replace
// Another bug: Change for undo/redo not doing anything.
// Not actually registering as a change, what's going on?
// Very "hacky" solution for now, want to change it
// This solution doesn't actually work, doesn't save the modifications to the array as part of the change
// Let's try yjs. For yjs need to encode Uint8Array as a string properly

export class WorkflowCollabService {
  private obj = automerge.from({
    undoStack: [] as Command[],
    redoStack: [] as Command[],
    changeDetector: 1 as number,
  });

  private doc1 = new Y.Doc();
  private doc2 = new Y.Doc();

//  private socket = webSocket({
//    url: 'ws://localhost:1234/automerge',
//  });

  constructor() {
    const self = this;
//    this.socket.subscribe({
//      next(response) {
//        console.log('Message received!');
//        console.log(response);
//        if (typeof(response) === 'object' && response !== null) {
//          if (response.hasOwnProperty('response')) {
//          } else if (response.hasOwnProperty('initial')) {
//            self.initializeAndSend();
//          } else if (response.hasOwnProperty('initialization')) { // If there's an initialization, we load it
//          }
//        }
//     },
//      error(err) {
//        console.log('problem');
//        console.log(JSON.stringify(err));
//        throw new Error(err);
//      },
//      complete() {
//        console.log('websocket finished and disconnected');
//      }
//    });
    console.log(this.doc1);
 }



  public addCommand(command: Command): void {
    const tempUndo = this.obj.undoStack;
    tempUndo.push(command);
    const newObj = automerge.change(this.obj, 'add', doc => {
      doc.undoStack = tempUndo;
      doc.redoStack = [];
      doc.changeDetector *= -1;
    });
    const changes = automerge.getChanges(this.obj, newObj);
    this.obj = automerge.applyChanges(this.obj, changes);
    // this.socket.next(JSON.stringify(changes));

    const initialData = automerge.save(this.obj);
    // this.socket.next('changeInitial' + initialData);
    console.log(this.obj);
    console.log(automerge.load(initialData));


    // Yjs test
    this.doc1.getArray('undo').push([command]);
    console.log(this.doc1.getArray('undo').length);
    console.log(this.doc2.getArray('undo').length);

    const update = Y.encodeStateAsUpdate(this.doc1);
    const testUpdate = this.stringtoUpdate(update.toString());
    console.log(update);
    console.log(testUpdate);
    Y.applyUpdate(this.doc2, testUpdate);
    console.log(this.doc1.getArray('undo').length);
    console.log(this.doc2.getArray('undo').length);
    console.log(this.doc1.getArray('undo').get(this.doc1.getArray('undo').length));

    this.doc1.getArray('undo').delete(0, this.doc1.getArray('undo').length);
    console.log(this.doc1.getArray('undo').length);

    // Seems to work? Now need to setup
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
          doc.changeDetector *= -1;
        });
        const changes = automerge.getChanges(this.obj, newObj);
        this.obj = automerge.applyChanges(this.obj, changes);
        const initialData = automerge.save(this.obj);
        // this.socket.next('changeInitial' + initialData);
      }
    }
  }

  public initializeAndSend() {
    // this.socket.next('changeInitial' + automerge.save(this.obj));
  }

  public initializeFromServer(newDoc: string) {
    this.obj = automerge.load(newDoc);
    console.log(this.obj);
  }

  private stringtoUpdate(update: String): Uint8Array {
    const parsed = update.toString().split(',');
    const output = new Uint8Array(parsed.length);
    for (let i = 0; i < parsed.length; i++) {
      // tslint:disable-next-line:radix
      output[i] = parseInt(parsed[i]);
    }
    return output;
  }
}
