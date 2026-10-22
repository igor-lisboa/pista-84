import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('docs/screenshots',{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto('http://127.0.0.1:4173');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'docs/screenshots/desktop.png'});
await page.locator('#garageNav').click();await page.screenshot({path:'docs/screenshots/garage.png'});await page.locator('#closeModal').click();
await page.locator('#start').click();await page.screenshot({path:'docs/screenshots/race.png'});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:'docs/screenshots/mobile.png'});
await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await page.screenshot({path:'docs/screenshots/mobile-landscape.png'});await browser.close();
