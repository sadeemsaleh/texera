import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';
import { WorkflowUtilService } from '../workflow-graph/util/workflow-util.service';
import { WorkflowActionService } from '../workflow-graph/model/workflow-action.service';
import { Point, OperatorPredicate, OperatorLink, OperatorPort } from '../../types/workflow-common.interface';
import { JointUIService } from '../joint-ui/joint-ui.service';

export interface Group {
  groupID: string;
  operators: Map<string, OperatorInfo>;
  links: Map<string, LinkInfo>;
  inLinks: Map<string, OperatorPort>;
  outLinks: Map<string, OperatorPort>;
  collapsed: boolean;
}

export type OperatorInfo = {
  operator: OperatorPredicate,
  position: Point,
  layer: number
};

export type LinkInfo = {
  link: OperatorLink,
  layer: number
};

export type GroupBoundingBox = {
  topLeft: Point,
  bottomRight: Point
};

type groupSizeType = {
  groupID: string,
  width: number,
  height: number
};

@Injectable()
export class GroupOperatorService {

  private groupIDMap = new Map<string, Group>();
  private groupResizeStream = new Subject<groupSizeType>();

  private listenOperatorPositionChange = true;

  constructor(
    private workflowUtilService: WorkflowUtilService,
    private workflowActionService: WorkflowActionService,
    private jointUIService: JointUIService
  ) {
    this.handleTexeraGraphLinkDelete();
    this.handleTexeraGraphLinkAdd();
    this.handleTexeraGraphOperatorDelete();

    this.handleOperatorPositionChange();
    this.handleGroupPositionChange();
    this.handleOperatorLayerChange();
    this.handleLinkLayerChange();
  }

  /**
   * Groups all given operators together.
   *
   * If there're less than two operators in the array, or if any one of the
   * operators is already in a group, the action will be ignored.
   *
   * All cells related to the group (including the group itself) will be moved to the front.
   *
   * @param operatorIDs
   */
  public groupOperators(operatorIDs: string[]): void {
    if (operatorIDs.length < 2) {
      return;
    }
    for (const operatorID of operatorIDs) {
      if (this.getGroupByOperator(operatorID)) {
        return;
      }
    }

    const group = this.getNewGroup(operatorIDs);
    this.workflowActionService.addGroup(group, this.getGroupBoundingBox(group));
    this.groupIDMap.set(group.groupID, group);
    this.moveGroupToLayer(group, this.getHighestLayer() + 1);
  }

  /**
   * Ungroups the given group. If the group is collapsed, it will be
   * expanded before ungrouping.
   *
   * @param groupID
   */
  public ungroupOperators(groupID: string): void {
    const group = this.getGroup(groupID);

    // if the group is collapsed, show all hidden operators & links before ungrouping
    if (group.collapsed) {
      this.workflowActionService.getJointGraphWrapper().showOperatorsAndLinks(group);
    }

    this.workflowActionService.deleteGroup(group);
    this.groupIDMap.delete(groupID);
  }

  /**
   * Collapses the given group. All operators and links within the group will be
   * hidden, and the collapse button will be changed to expand button.
   *
   * @param groupID
   * @param jointPaper
   */
  public collapseGroup(groupID: string, jointPaper: joint.dia.Paper): void {
    const group = this.getGroup(groupID);

    // collapse group on joint graph
    this.workflowActionService.getJointGraphWrapper().setElementSize(groupID, 170, 30);
    this.jointUIService.showGroupExpandButton(jointPaper, groupID);

    // hide embedded operators & links
    this.workflowActionService.getJointGraphWrapper().hideOperatorsAndLinks(group);

    group.collapsed = true;
  }

  /**
   * Expands the given group. All hidden operators and links will reappear on the
   * joint graph, and the expand button will be changed to collapse button.
   *
   * @param groupID
   * @param jointPaper
   */
  public expandGroup(groupID: string, jointPaper: joint.dia.Paper): void {
    const group = this.getGroup(groupID);

    // expand group on joint graph
    this.repositionGroup(group);
    this.jointUIService.showGroupCollapseButton(jointPaper, groupID);

    // show embedded operators & links
    this.workflowActionService.getJointGraphWrapper().showOperatorsAndLinks(group);

    group.collapsed = false;
  }

  /**
   * Gets the group with the groupID.
   * Throws an error if the group doesn't exist.
   *
   * @param groupID
   */
  public getGroup(groupID: string): Group {
    const group = this.groupIDMap.get(groupID);
    if (! group) {
      throw new Error(`group with ID ${groupID} doesn't exist`);
    }
    return group;
  }

  /**
   * Gets the group that the given operator resides in.
   * Returns undefined if there's no such a group.
   *
   * @param operatorID
   */
  public getGroupByOperator(operatorID: string): Group | undefined {
    for (const group of Array.from(this.groupIDMap.values())) {
      if (group.operators.has(operatorID)) {
        return group;
      }
    }
    return undefined;
  }

  /**
   * Gets the event stream of a group being resized.
   */
  public getGroupResizeStream(): Observable<groupSizeType> {
    return this.groupResizeStream.asObservable();
  }

  /**
   * Creates a new group for given operators.
   *
   * A new group contains the following:
   *  - groupID: the identifier of the group
   *  - operators: a map of all the operators in the group, recording each operator
   *    and their corresponding position and layer
   *  - links: a map of all the links in the group, recording each link and their corresponding layer
   *  - inLinks: a map of all the links whose target operators are in the group,
   *    recording each link's target port
   *  - outLinks: a map of all the links whose source operators are in the group,
   *    recording each link's source port
   *  - collapsed: a boolean value that indicates whether the group is collaped or expanded
   *
   * @param operatorIDs
   */
  private getNewGroup(operatorIDs: string[]): Group {
    const groupID = this.workflowUtilService.getGroupRandomUUID();

    const operators = new Map<string, OperatorInfo>();
    const links = new Map<string, LinkInfo>();
    const inLinks = new Map<string, OperatorPort>();
    const outLinks = new Map<string, OperatorPort>();

    operatorIDs.forEach(operatorID => {
      const operator = this.workflowActionService.getTexeraGraph().getOperator(operatorID);
      const position = this.workflowActionService.getJointGraphWrapper().getElementPosition(operatorID);
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(operatorID);
      operators.set(operatorID, {operator, position, layer});
    });

    this.workflowActionService.getTexeraGraph().getAllLinks().forEach(link => {
      if (operators.has(link.source.operatorID) && operators.has(link.target.operatorID)) {
        const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(link.linkID);
        links.set(link.linkID, {link, layer});
      } else if (!operators.has(link.source.operatorID) && operators.has(link.target.operatorID)) {
        inLinks.set(link.linkID, link.target);
      } else if (operators.has(link.source.operatorID) && !operators.has(link.target.operatorID)) {
        outLinks.set(link.linkID, link.source);
      }
    });

    return {groupID, operators, links, inLinks, outLinks, collapsed: false};
  }

  /**
   * Gets the bounding box of the group.
   *
   * A bounding box contains two points, defining the group's position and size.
   *  - topLeft indicates the position of the operator (if there was one) that's in
   *    the top left corner of the group
   *  - bottomRight indicates the position of the operator (if there was one) that's
   *    in the bottom right corner of the group
   *
   * @param group
   */
  private getGroupBoundingBox(group: Group): GroupBoundingBox {
    const randomOperator = group.operators.get(Array.from(group.operators.keys())[0]);
    if (! randomOperator) {
      throw new Error(`Internal error: group with ID ${group.groupID} is invalid`);
    }

    const topLeft = {x: randomOperator.position.x, y: randomOperator.position.y};
    const bottomRight = {x: randomOperator.position.x, y: randomOperator.position.y};

    group.operators.forEach(operatorInfo => {
      if (operatorInfo.position.x < topLeft.x) {
        topLeft.x = operatorInfo.position.x;
      }
      if (operatorInfo.position.y < topLeft.y) {
        topLeft.y = operatorInfo.position.y;
      }
      if (operatorInfo.position.x > bottomRight.x) {
        bottomRight.x = operatorInfo.position.x;
      }
      if (operatorInfo.position.y > bottomRight.y) {
        bottomRight.y = operatorInfo.position.y;
      }
    });

    return {topLeft, bottomRight};
  }

  /**
   * Gets the layer of the frontmost cell in the graph.
   */
  private getHighestLayer(): number {
    let highestLayer = 0;

    this.workflowActionService.getTexeraGraph().getAllOperators().forEach(operator => {
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(operator.operatorID);
      if (layer > highestLayer) {
        highestLayer = layer;
      }
    });
    this.workflowActionService.getTexeraGraph().getAllLinks().forEach(link => {
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(link.linkID);
      if (layer > highestLayer) {
        highestLayer = layer;
      }
    });

    return highestLayer;
  }

  /**
   * Moves the given group to the given layer. All related cells (embedded operators,
   * links, inLinks, and outLinks) will be moved to corresponding new layers:
   *    own layer + group's new layer
   *
   * @param group
   * @param groupLayer
   */
  private moveGroupToLayer(group: Group, groupLayer: number): void {
    group.operators.forEach((operatorInfo, operatorID) => {
      this.workflowActionService.getJointGraphWrapper().setCellLayer(operatorID, operatorInfo.layer + groupLayer);
    });
    group.links.forEach((linkInfo, linkID) => {
      this.workflowActionService.getJointGraphWrapper().setCellLayer(linkID, linkInfo.layer + groupLayer);
    });
    group.inLinks.forEach((port, linkID) => {
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(linkID);
      this.workflowActionService.getJointGraphWrapper().setCellLayer(linkID, layer + groupLayer);
    });
    group.outLinks.forEach((port, linkID) => {
      const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(linkID);
      this.workflowActionService.getJointGraphWrapper().setCellLayer(linkID, layer + groupLayer);
    });
    this.workflowActionService.getJointGraphWrapper().setCellLayer(group.groupID, groupLayer);
  }

  /**
   * Repositions and resizes the given group to fit its embedded operators.
   * @param group
   */
  private repositionGroup(group: Group): void {
    const {topLeft, bottomRight} = this.getGroupBoundingBox(group);

    // calculates group's new position
    const originalPosition = this.workflowActionService.getJointGraphWrapper().getElementPosition(group.groupID);
    const offsetX = topLeft.x - JointUIService.DEFAULT_GROUP_MARGIN - originalPosition.x;
    const offsetY = topLeft.y - JointUIService.DEFAULT_GROUP_MARGIN - originalPosition.y;

    // calculates group's new height & width
    const width = bottomRight.x - topLeft.x + JointUIService.DEFAULT_OPERATOR_WIDTH + 2 * JointUIService.DEFAULT_GROUP_MARGIN;
    const height = bottomRight.y - topLeft.y + JointUIService.DEFAULT_OPERATOR_HEIGHT + 2 * JointUIService.DEFAULT_GROUP_MARGIN;

    // reposition the group and embedded operators to offset the side effect of embedding + repositioning
    this.listenOperatorPositionChange = false;
    this.workflowActionService.getJointGraphWrapper().setElementPosition(group.groupID, offsetX, offsetY);
    if (!group.collapsed) {
      group.operators.forEach((operatorInfo, operatorID) => {
        this.workflowActionService.getJointGraphWrapper().setElementPosition(operatorID, -offsetX, -offsetY);
      });
    }
    this.listenOperatorPositionChange = true;

    // resize the group according to the new size
    this.workflowActionService.getJointGraphWrapper().setElementSize(group.groupID, width, height);
    this.groupResizeStream.next({groupID: group.groupID, height: height, width: width});
  }

  /**
   * Handles operator delete events on texera graph.
   * If the deleted operator is embedded in some group,
   *  1) remove the operator from the group
   *  2) delete the group if there're less than two operators left
   *  3) reposition the group to fit remaining operators otherwise
   */
  private handleTexeraGraphOperatorDelete(): void {
    this.workflowActionService.getTexeraGraph().getOperatorDeleteStream()
      .map(operator => operator.deletedOperator)
      .subscribe(deletedOperator => {
        this.groupIDMap.forEach(group => {
          if (group.operators.has(deletedOperator.operatorID)) {
            group.operators.delete(deletedOperator.operatorID);
            if (group.operators.size < 2) {
              this.ungroupOperators(group.groupID);
            } else {
              this.repositionGroup(group);
            }
          }
        });
      });
  }

  /**
   * Handles link add events on texera graph.
   * Checks if the added link is related to some group, and add the
   * link to the group as a link, inLink, or outLink.
   */
  private handleTexeraGraphLinkAdd(): void {
    this.workflowActionService.getTexeraGraph().getLinkAddStream().subscribe(link => {
      this.groupIDMap.forEach(group => {
        if (group.operators.has(link.source.operatorID) && group.operators.has(link.target.operatorID)) {
          const layer = this.workflowActionService.getJointGraphWrapper().getCellLayer(link.linkID);
          group.links.set(link.linkID, {link, layer});
        } else if (!group.operators.has(link.source.operatorID) && group.operators.has(link.target.operatorID)) {
          group.inLinks.set(link.linkID, link.target);
        } else if (group.operators.has(link.source.operatorID) && !group.operators.has(link.target.operatorID)) {
          group.outLinks.set(link.linkID, link.source);
        }
      });
    });
  }

  /**
   * Handles link delete events on texera graph.
   * If the deleted link is related to some group, remove it from the group.
   */
  private handleTexeraGraphLinkDelete(): void {
    this.workflowActionService.getTexeraGraph().getLinkDeleteStream()
      .map(link => link.deletedLink)
      .subscribe(deletedLink => {
        this.groupIDMap.forEach(group => {
          if (group.links.has(deletedLink.linkID)) {
            group.links.delete(deletedLink.linkID);
          } else if (group.inLinks.has(deletedLink.linkID)) {
            group.inLinks.delete(deletedLink.linkID);
          } else if (group.outLinks.has(deletedLink.linkID)) {
            group.outLinks.delete(deletedLink.linkID);
          }
        });
      });
  }

  /**
   * Handles operator position change events.
   * If the moved operator is embedded in some group,
   *  1) update the operator's position stored in the group
   *  2) reposition the group to fit the moved operator
   */
  private handleOperatorPositionChange(): void {
    this.workflowActionService.getJointGraphWrapper().getElementPositionChangeEvent()
      .filter(() => this.listenOperatorPositionChange)
      .filter(movedElement => this.workflowActionService.getTexeraGraph().hasOperator(movedElement.elementID))
      .subscribe(movedOperator => {
        this.groupIDMap.forEach(group => {
          const operatorInfo = group.operators.get(movedOperator.elementID);
          if (operatorInfo) {
            operatorInfo.position = movedOperator.newPosition;
            group.operators.set(movedOperator.elementID, operatorInfo);
            this.repositionGroup(group);
          }
        });
      });
  }

  /**
   * Handles group position change events.
   * If the group is collapsed when it's moved, update its embedded operators'
   * position according to the relative offset, so that operators are in the
   * right position when the moved group is expanded.
   */
  private handleGroupPositionChange(): void {
    this.workflowActionService.getJointGraphWrapper().getElementPositionChangeEvent()
      .filter(movedElement => this.groupIDMap.has(movedElement.elementID))
      .subscribe(movedGroup => {
        const group = this.getGroup(movedGroup.elementID);
        if (group.collapsed) {
          const offsetX = movedGroup.newPosition.x - movedGroup.oldPosition.x;
          const offsetY = movedGroup.newPosition.y - movedGroup.oldPosition.y;
          group.operators.forEach((operatorInfo, operatorID) => {
            operatorInfo.position = {x: operatorInfo.position.x + offsetX, y: operatorInfo.position.y + offsetY};
            group.operators.set(operatorID, operatorInfo);
          });
        }
      });
  }

  /**
   * Handles operator layer change events.
   * If the operator is embedded in some group, update its layer stored in the group.
   */
  private handleOperatorLayerChange(): void {
    this.workflowActionService.getJointGraphWrapper().getCellLayerChangeEvent()
      .filter(movedOperator => this.workflowActionService.getTexeraGraph().hasOperator(movedOperator.cellID))
      .subscribe(movedOperator => {
        this.groupIDMap.forEach(group => {
          const operatorInfo = group.operators.get(movedOperator.cellID);
          if (operatorInfo) {
            operatorInfo.layer = movedOperator.newLayer;
            group.operators.set(movedOperator.cellID, operatorInfo);
          }
        });
      });
  }

  /**
   * Handles link layer change events.
   * If the link is embedded in some group, update its layer stored in the group.
   */
  private handleLinkLayerChange(): void {
    this.workflowActionService.getJointGraphWrapper().getCellLayerChangeEvent()
      .filter(movedLink => this.workflowActionService.getTexeraGraph().hasLinkWithID(movedLink.cellID))
      .subscribe(movedLink => {
        this.groupIDMap.forEach(group => {
          const linkInfo = group.links.get(movedLink.cellID);
          if (linkInfo) {
            linkInfo.layer = movedLink.newLayer;
            group.links.set(movedLink.cellID, linkInfo);
          }
        });
      });
  }

}
