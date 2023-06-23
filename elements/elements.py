# Simple script to generate the list of elements

import os

for f in os.listdir("."):
    if f != "elements.py":  # lol
        name = f.split(".")[0]
        # print(f"new Element(\"{name}\", \"{name[0:2]}\", \"\", 0),")
        print(f"<img src=\"elements/{f}\" id=\"{name}\"></img>")