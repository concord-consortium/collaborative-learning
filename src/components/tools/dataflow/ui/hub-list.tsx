import React from "react";

export const HubList = () => {
  return (
    <div className="hub-list">
      Placeholder hub list
    </div>
  );
};

// import { inject, observer } from "mobx-react";
// import { BaseComponent, IBaseProps } from "./dataflow-base";
// import React from "react";
// import "./hub-list.sass";
// import { HubModelType, HubChannelType } from "../models/stores/hub-store";

// interface IProps extends IBaseProps {}

// interface IState {}

// @inject("stores")
// @observer
// export class HubListComponent extends BaseComponent<IProps, IState> {
//   public render() {
//     return (
//       <div>
//         <div className="hub-list">
//           <div className="hub-list-title">
//           Registered IoT Hubs
//           </div>
//           <div className="hubs">
//           { this.renderHubs() }
//           </div>
//         </div>
//       </div>
//     );
//   }

//   private renderHubs() {
//     const { hubStore } = this.stores;
//     const hubs: JSX.Element[] = [];
//     hubStore.hubs.forEach((hub) => {
//       hubs.push(this.renderHub(hub));
//     });
//     return hubs;
//   }

//   private renderHub(hub: HubModelType) {
//     const onlineStatus = hub.getOnlineStatus() ? "online" : "offline";
//     return (
//       <div key={hub.hubProviderId} className="hub">
//         <div className="label name">{ hub.hubName }</div>
//         <div className="label">{ `status: ${onlineStatus}` }</div>
//         <div className="label">
//         { hub.hubChannels && hub.hubChannels.length > 0 ?
//           "channels:" :
//           "no channels available" }
//         </div>
//         { hub.hubChannels.map( (ch) => {
//             let count = 0;
//             hub.hubChannels.forEach( c => { if (c.type === ch.type) count++; } );
//             return this.renderHubChannel(ch, count > 1);
//           }) }
//       </div>
//     );
//   }

//   private renderHubChannel(ch: HubChannelType, showPlug: boolean) {
//     const plug = ch.plug > 0 && showPlug ? ` (plug ${ch.plug})` : "";
//     const channelClass = "channel " + (ch.missing ? "missing" : "");
//     const channelText = `${ch.type}${plug}: ` + (ch.missing ? "Finding device" : `${ch.value} ${ch.units}`);
//     return (
//       <div className={channelClass} key={ch.id}>
//         <div className="label">{channelText}</div>
//       </div>
//     );
//   }

// }
