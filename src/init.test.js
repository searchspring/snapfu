const { createDir, transform } = require('./init')
const os = require('os')
const fs = require('fs').promises
const path = require('path')
const { fail } = require('assert')
const { Readable } = require('stream')
const MemoryStream = require('memorystream')

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

describe('transforms', () => {
    it('change name', async () => {
        let read = Readable.from(
            Buffer.from(
                'the name is: {{  snapfu.name}} by author: {{snapfu.author}}',
                'utf8'
            )
        )
        let write = MemoryStream.createWriteStream()

        await transform(read, write, {
            'snapfu.name': 'destination name',
            'snapfu.author': 'codeallthethingz',
        })
        expect(write.toString()).toEqual(
            'the name is: destination name by author: codeallthethingz'
        )
    })
})
