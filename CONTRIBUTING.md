1. For commit messages, specify what kind of change is happening with lines like this:

        <prefix>: Description of the change

    Where `<prefix>` is one of the following:

    | prefix | what to use it for |
    |---|---|
    | `break` | **IMPORTANT:** Change breaks backward compatibility |
    | `fix` | Change fixes a bug |
    | `feature` | Change adds a new feature |
    | `info` | Informational change |
    | `doc` | Documentation change |
    | `refactor` | Change is a refactor |

2. The tests ought to pass.
