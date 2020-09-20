const { createDir, cloneTemplate } = require('./init')
const os = require('os')
const fs = require('fs').promises
const path = require('path')
const { fail } = require('assert')

beforeEach(async () => {})

describe('check empty dir', () => {
    it('is empty', async () => {
        let folder = await fs
            .mkdtemp(path.join(os.tmpdir(), 'snapfutest-'))
            .then(async (folder, err) => {
                if (err) throw err
                await fs.writeFile(folder + '/somefile.txt', 'some content')
                return folder
            })
        await createDir(folder)
            .then(() => {
                fail()
            })
            .catch((err) => {
                expect(err).toEqual('folder not empty, exiting')
            })
    })
})
