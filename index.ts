#!/usr/bin/env node
import * as os from 'os';

const chalk = require(`chalk`);
const duplexer = require(`duplexer`);
const groupBy = require(`lodash.groupby`);
const pluralize = require(`pluralize`);
const symbols = require(`figures`);
const tapOut = require(`tap-out`);
const through = require(`through2`);
const trimStart = require(`lodash.trimstart`);

class Test {
    private _failed = false;

    constructor(readonly name: string) {
        // ???
    }

    get failed() {
        return this._failed;
    }

    set failed(failed: boolean) {
        this._failed = failed;
    }
}

type Options = {
    hideSuccess: boolean;
};

type Assertion = {
    name: string;
    error: {
        raw: string;
    };
};

const count = (n: number, word: string) => `${n} ${pluralize(word, n)}`;
const coloured = (colour: (s: string) => string, text: string): string => colour(text);

module.exports = (opts: Options) => {
    const output = through();
    const parser = tapOut();
    const stream = duplexer(parser, output);
    const println = (text: string = ``): void => output.push(`${text}${os.EOL}`);

    let next: Test;
    parser.on(`test`, (test: any) => {
        if (next) {
            if (!next.failed && opts.hideSuccess) {
                return;
            }

            const symbol = next.failed ? chalk.red(symbols.cross) : chalk.green(symbols.tick);
            println(`${symbol}  ${next.name}`);
        }

        next = new Test(test.name);
    });

    parser.on(`fail`, () => {
        next.failed = stream.failed = true;
    });

    parser.on(`output`, function (results: any) {
        if (results.tests.length === 0) {
            println(coloured(chalk.dim, `No tests found`));
            return;
        }

        println();
        println(`${count(results.tests.length, `test`)} (${count(results.asserts.length, `assertion`)})`);
        println();

        if (results.fail.length) {
            println(coloured(chalk.red.bold, `${count(results.fail.length, `failure`)}:`));
            println();

            const padding = `    `;
            const failedAssertionsByTest = groupBy(results.fail, (assertion: any) => assertion.test);
            Object.keys(failedAssertionsByTest).forEach(testNumber => {
                const assertions: Assertion[] = failedAssertionsByTest[testNumber];
                const test = results.tests.find((t: any) => t.number === parseInt(testNumber, 10));
                println(`${padding}${test.name}`);
                println();
                assertions.forEach(assertion => {
                    println(coloured(chalk.red, `${padding.repeat(2)}${symbols.cross} ${assertion.name}`));
                    assertion.error.raw.split(os.EOL)
                        .map(line => trimStart(line))
                        .forEach(line => println(coloured(chalk.cyan, `${padding.repeat(2)}${line}`)));
                    println();
                });
            });
        }
    });

    return stream;
};

if (!module.parent) {
    // CLI mode, woo!
    const flag = (name: string): boolean => !!require(`has-flag`)(name);
    const stream = module.exports({
        hideSuccess: flag(`hide-success`),
    });

    process.stdin.pipe(stream).pipe(process.stdout);
    process.on(`exit`, (status: number) => process.exit((status === 1 || stream.failed) ? 1 : 0));
}
