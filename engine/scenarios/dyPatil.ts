// SCENARIO_A, copied verbatim from reference/prototype.html. Do not edit values without updating the golden test.
import type { Scenario } from '../types';

export const dyPatil: Scenario = {
  id:'dyPatil',
  name:'Stadium night — DY Patil Stadium, Nerul',
  lateBookings:1400,
  sub:'84,000 capacity · gates 16:00 · show 19:30',
  venueLabel:'DY Patil Stadium',
  mapZones:['nerul_stn','palm_drop','parking_s20','fc_west','fc_north','fc_east','gate3','gate1','gate5','bowl'],
  t0Min:840, horizon:540, gatesOpenTick:120, showStartTick:330, laneRate:28,
  zones:[
    {id:'nerul_stn',  name:'Nerul station',       type:'transit',lat:19.0332,lng:73.0186,areaM2:3400},
    {id:'seawoods_stn',name:'Seawoods Darave',    type:'transit',lat:19.0194,lng:73.0210,areaM2:3000},
    {id:'palm_drop',  name:'Palm Beach drop-off', type:'transit',lat:19.0400,lng:73.0150,areaM2:2200},
    {id:'parking_s20',name:'Parking, Sector 20',  type:'parking',lat:19.0505,lng:73.0300,areaM2:9000},
    {id:'vashi_htl',  name:'Vashi hotels',        type:'hotel',lat:19.0760,lng:72.9990,rooms:2400,occupied:2280,price:6400},
    {id:'belapur_htl',name:'CBD Belapur hotels',  type:'hotel',lat:19.0210,lng:73.0380,rooms:1800,occupied:1750,price:5800},
    {id:'kharghar_htl',name:'Kharghar hotels',    type:'hotel',lat:19.0470,lng:73.0690,rooms:2100,occupied:1180,price:4200},
    {id:'panvel_htl', name:'Panvel hotels',       type:'hotel',lat:18.9950,lng:73.1150,rooms:1600,occupied:640,price:3100},
    {id:'fc_west',    name:'West forecourt',      type:'plaza',lat:19.0436,lng:73.0206,areaM2:1600},
    {id:'fc_north',   name:'North forecourt',     type:'plaza',lat:19.0472,lng:73.0250,areaM2:3400},
    {id:'fc_east',    name:'East forecourt',      type:'plaza',lat:19.0440,lng:73.0292,areaM2:2800},
    {id:'gate3',      name:'Gate 3',              type:'gate',lat:19.0441,lng:73.0219,areaM2:400,lanes:12},
    {id:'gate1',      name:'Gate 1',              type:'gate',lat:19.0463,lng:73.0248,areaM2:400,lanes:10},
    {id:'gate5',      name:'Gate 5',              type:'gate',lat:19.0444,lng:73.0279,areaM2:400,lanes:8},
    {id:'bowl',       name:'Stadium bowl',        type:'venue',lat:19.0452,lng:73.0249,areaM2:42000,capacity:84000},
    {id:'food_west',  name:'West forecourt food stalls', type:'food',lat:19.0432,lng:73.0198,near:'fc_west',stalls:6,serviceRate:6},
    {id:'food_east',  name:'East forecourt food stalls', type:'food',lat:19.0446,lng:73.0300,near:'fc_east',stalls:1,serviceRate:1}
    ],
  links:[
    {id:'L1', from:'nerul_stn',   to:'fc_west', name:'Nerul skywalk',            mode:'walk',   cap:520, ff:9,  areaM2:4200},
    {id:'L2', from:'seawoods_stn',to:'fc_west', name:'Seawoods shuttle corridor',mode:'shuttle',cap:430, ff:12},
    {id:'L3', from:'palm_drop',   to:'fc_west', name:'West approach',            mode:'walk',   cap:380, ff:5,  areaM2:2000},
    {id:'L4', from:'parking_s20', to:'fc_north',name:'Parking causeway',         mode:'walk',   cap:640, ff:7,  areaM2:4200},
    {id:'L5', from:'vashi_htl',   to:'fc_north',name:'Thane–Belapur road',       mode:'road',   cap:520, ff:26},
    {id:'L6', from:'belapur_htl', to:'fc_east', name:'Belapur approach',         mode:'road',   cap:460, ff:14},
    {id:'L7', from:'kharghar_htl',to:'fc_east', name:'Sion–Panvel highway',      mode:'road',   cap:420, ff:18},
    {id:'L8', from:'panvel_htl',  to:'fc_east', name:'Panvel corridor',          mode:'road',   cap:360, ff:30},
    {id:'L9', from:'fc_west',     to:'gate3',   name:'Gate 3 screening',         mode:'gate',   gate:'gate3'},
    {id:'L10',from:'fc_north',    to:'gate1',   name:'Gate 1 screening',         mode:'gate',   gate:'gate1'},
    {id:'L11',from:'fc_east',     to:'gate5',   name:'Gate 5 screening',         mode:'gate',   gate:'gate5'},
    {id:'L12',from:'gate3',       to:'bowl',    name:'West concourse',           mode:'walk',   cap:900, ff:3, areaM2:3000},
    {id:'L13',from:'gate1',       to:'bowl',    name:'North concourse',          mode:'walk',   cap:900, ff:3, areaM2:3000},
    {id:'L14',from:'gate5',       to:'bowl',    name:'East concourse',           mode:'walk',   cap:900, ff:3, areaM2:3000},
    {id:'L15',from:'nerul_stn',   to:'fc_east', name:'East service road',        mode:'walk',   cap:460, ff:17,areaM2:4000},
    {id:'L16',from:'fc_west',     to:'fc_east', name:'Perimeter path',           mode:'walk',   cap:300, ff:9, areaM2:1500}
  ],
  cohorts:[
    {id:'nerul_rail',   label:'Harbour line via Nerul',    size:24000,mean:302,std:29,ps:0.72,lang:'mr',pulse:{period:6,width:2,offset:0},path:['L1','L9','L12'], alt:['L15','L11','L14'],altExtraMin:8},
    {id:'seawoods_rail',label:'Harbour line via Seawoods', size:13000,mean:296,std:31,ps:0.70,lang:'mr',pulse:{period:7,width:2,offset:3},path:['L2','L9','L12'], alt:['L2','L16','L11','L14'],altExtraMin:9},
    {id:'taxi_drop',    label:'Cabs and autos, Palm Beach',size: 8600,mean:305,std:26,ps:0.34,lang:'en',path:['L3','L9','L12'], alt:['L3','L16','L11','L14'],altExtraMin:9},
    {id:'late_book',    label:'Late bookings, no room nearby',size:1400,mean:314,std:20,ps:0.50,lang:'hi',path:['L3','L9','L12'], alt:['L7','L11','L14'],altExtraMin:0,housed:['L7','L11','L14']},
    {id:'self_drive',   label:'Self-drive, Sector 20',     size:15000,mean:274,std:44,ps:0.24,lang:'en',path:['L4','L10','L13']},
    {id:'vashi_htl',    label:'Vashi hotel guests',        size:8000, mean:290,std:38,ps:0.45,lang:'hi',path:['L5','L10','L13']},
    {id:'belapur_htl',  label:'Belapur hotel guests',      size:5000, mean:292,std:36,ps:0.44,lang:'hi',path:['L6','L11','L14']},
    {id:'kharghar_htl', label:'Kharghar hotel guests',     size:6000, mean:284,std:40,ps:0.41,lang:'hi',path:['L7','L11','L14']},
    {id:'panvel_htl',   label:'Panvel hotel guests',       size:3000, mean:270,std:42,ps:0.58,lang:'mr',path:['L8','L11','L14']}
  ]
};
