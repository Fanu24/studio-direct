import {configurationErrors} from './deployment-config.mjs';
const errors=configurationErrors(process.env);
if(errors.length){console.error('Configuration incomplete:\n'+errors.map(x=>'- '+x).join('\n'));process.exitCode=1;}
else console.log('Configuration formats checked. Confirm remote resources and service delivery during activation.');
