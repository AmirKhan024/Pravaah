// SCENARIO_B from reference/prototype.html — kept only as an engine test fixture (scenario-agnostic proof).
import type { Scenario } from '../types';

export const marathon: Scenario = {
  id:'marathon',
  name:'City Marathon — Marine Drive, Mumbai',
  lateBookings:1000,
  sub:'42,000 runners & crew · corrals open 04:30 · gun at 06:00',
  venueLabel:'Marine Drive start festival',
  mapZones:['churchgate_stn','marine_stn','cab_drop','parking_worli','corral_north','corral_south','gateA','gateB','startvenue'],
  t0Min:270, horizon:180, gatesOpenTick:10, showStartTick:90, laneRate:22,
  zones:[
    {id:'churchgate_stn',name:'Churchgate station',  type:'transit',lat:18.9354,lng:72.8276,areaM2:2600},
    {id:'marine_stn',    name:'Marine Lines station',type:'transit',lat:18.9432,lng:72.8238,areaM2:2200},
    {id:'cab_drop',      name:'Marine Drive cab drop',type:'transit',lat:18.9440,lng:72.8220,areaM2:1500},
    {id:'parking_worli', name:'Worli parking',       type:'parking',lat:18.9975,lng:72.8175,areaM2:4200},
    {id:'hotel_churchgate',name:'Churchgate hotels',  type:'hotel',lat:18.9330,lng:72.8290,rooms:900, occupied:860,price:7200},
    {id:'hotel_worli',   name:'Worli hotels',        type:'hotel',lat:19.0000,lng:72.8170,rooms:1100,occupied:640,price:5200},
    {id:'hotel_bandra',  name:'Bandra hotels',       type:'hotel',lat:19.0600,lng:72.8330,rooms:1400,occupied:520,price:4100},
    {id:'corral_north',  name:'North corral',        type:'plaza',lat:18.9420,lng:72.8230,areaM2:2450},
    {id:'corral_south',  name:'South corral',        type:'plaza',lat:18.9470,lng:72.8210,areaM2:2300},
    {id:'gateA',         name:'Checkpoint A',        type:'gate',lat:18.9410,lng:72.8225,areaM2:350,lanes:10},
    {id:'gateB',         name:'Checkpoint B',        type:'gate',lat:18.9480,lng:72.8205,areaM2:350,lanes:8},
    {id:'startvenue',    name:'Start festival ground',type:'venue',lat:18.9440,lng:72.8215,areaM2:25000,capacity:42000},
    {id:'food_north',    name:'North corral hydration & food', type:'food',lat:18.9418,lng:72.8218,near:'corral_north',stalls:5,serviceRate:6},
    {id:'food_south',    name:'South corral hydration & food', type:'food',lat:18.9468,lng:72.8198,near:'corral_south',stalls:4,serviceRate:6}
    ],
  links:[
    {id:'M1', from:'churchgate_stn',  to:'corral_north',name:'Churchgate walkway',    mode:'walk',cap:420,ff:7, areaM2:2600},
    {id:'M2', from:'marine_stn',      to:'corral_north',name:'Marine Lines walkway',  mode:'walk',cap:380,ff:5, areaM2:2200},
    {id:'M3', from:'cab_drop',        to:'corral_north',name:'Promenade approach',    mode:'walk',cap:260,ff:4, areaM2:1500},
    {id:'M4', from:'hotel_churchgate',to:'corral_north',name:'Churchgate road',       mode:'road',cap:300,ff:12},
    {id:'M5', from:'parking_worli',   to:'corral_south',name:'Worli service road',    mode:'walk',cap:340,ff:9, areaM2:2400},
    {id:'M6', from:'hotel_worli',     to:'corral_south',name:'Worli sea face road',   mode:'road',cap:320,ff:16},
    {id:'M7', from:'hotel_bandra',    to:'corral_south',name:'Bandra–Worli link road',mode:'road',cap:280,ff:24},
    {id:'M8', from:'corral_north',    to:'gateA',        name:'Checkpoint A screening',mode:'gate',gate:'gateA'},
    {id:'M9', from:'corral_south',    to:'gateB',        name:'Checkpoint B screening',mode:'gate',gate:'gateB'},
    {id:'M10',from:'gateA',           to:'startvenue',   name:'North funnel',         mode:'walk',cap:700,ff:3, areaM2:2200},
    {id:'M11',from:'gateB',           to:'startvenue',   name:'South funnel',         mode:'walk',cap:600,ff:3, areaM2:2000}
  ],
  cohorts:[
    {id:'churchgate_local',label:'Western line via Churchgate', size:14000,mean:68,std:16,ps:0.55,lang:'mr',pulse:{period:8,width:2,offset:0},path:['M1','M8','M10']},
    {id:'marine_local',    label:'Western line via Marine Lines',size:8000, mean:64,std:18,ps:0.52,lang:'mr',pulse:{period:9,width:2,offset:3},path:['M2','M8','M10']},
    {id:'late_reg',        label:'Late registrations, cab drop', size:1000, mean:82,std:10,ps:0.48,lang:'hi',path:['M3','M8','M10']},
    {id:'hotel_churchgate',label:'Churchgate hotel guests',      size:2000, mean:60,std:20,ps:0.40,lang:'en',path:['M4','M8','M10']},
    {id:'self_drive',      label:'Self-drive, Worli parking',    size:7000, mean:55,std:22,ps:0.30,lang:'en',path:['M5','M9','M11']},
    {id:'hotel_worli',     label:'Worli hotel guests',           size:6000, mean:58,std:20,ps:0.42,lang:'hi',path:['M6','M9','M11']},
    {id:'hotel_bandra',    label:'Bandra hotel guests',          size:4000, mean:50,std:24,ps:0.44,lang:'hi',path:['M7','M9','M11']}
  ]
};
