import puppeteer from "puppeteer";

const skipConsole = process.env.PUPPETEER_SKIP_CONSOLE === 'true' || process.env.PUPPETEER_SKIP_CONSOLE === '1';

export class VirtualBrowser {
  browser;

  constructor() {

  }

  async getBrowser () {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
      });
    }

    return this.browser;
  }

  async openPage (url) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    if (!skipConsole) {
      // Listen for browser console messages
      page.on('console', msg => {
        const type = msg.type();

        if (type === "error" || type === "debug") {
          console.error(`[Browser Console] ${msg.type()}: ${msg.text()}`);
        }
      });
    }

    await page.goto(url);

    return page;
  }

  async close () {
    await (await this.getBrowser()).close();
  }

  // Singleton
  static instance;

  static getInstance() {
    if (!VirtualBrowser.instance) {
      VirtualBrowser.instance = new VirtualBrowser();
    }

    return VirtualBrowser.instance;
  }
}