1. Specify changes by creating single line text files in `changes/`  The filename should be of the form:

        <prefix>-<identifier>.md

    where `<prefix>` is one of:

    | prefix | what to use it for |
    |---|---|
    | `break` | **IMPORTANT:** Change breaks backward compatibility |
    | `fix` | Change fixes a bug |
    | `feature`, `new` | Change adds a new feature |
    | `info` | Informational change |
    | `doc` | Documentation change |
    | `refactor` | Change is a refactor |

    and `<identifier>` is a unique-ish identifier such as an issue number, your name, a short description of the change, etc...

2. The tests ought to pass.
