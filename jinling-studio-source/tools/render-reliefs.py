import bpy, json, sys
from pathlib import Path
from mathutils import Vector
base = Path(__file__).resolve().with_name('.render')
wanted = set(sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else set()
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,energy,color,size):
    light=bpy.data.lights.new(name,'AREA')
    light.energy=energy;light.color=color;light.shape='DISK';light.size=size
    obj=bpy.data.objects.new(name,light)
    bpy.context.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,0))
for model in sorted(base.glob('*.json')):
    key = model.stem.split('-s')[0]
    if wanted and key not in wanted:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    step = '-s' in model.stem
    scene.render.engine='CYCLES';scene.cycles.samples=10 if step else 40;scene.cycles.use_denoising=False
    scene.render.threads_mode='FIXED';scene.render.threads=8
    scene.render.resolution_x=330 if step else 490;scene.render.resolution_y=283 if step else 420;scene.render.resolution_percentage=100
    scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.world=bpy.data.worlds.new('Soft bounce');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.48
    scene.view_settings.view_transform='AgX'
    materials={}
    for rgb,rough,vertices,index in json.loads(model.read_text()):
        key=tuple(rgb)+(rough,)
        if key not in materials:
            mat=bpy.data.materials.new('Paper' if rough>.8 else 'Dough')
            mat.use_nodes=True
            nodes=mat.node_tree.nodes;links=mat.node_tree.links
            shader=nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*rgb,1)
            shader.inputs['Roughness'].default_value=rough
            shader.inputs['Subsurface Weight'].default_value=0 if rough>.8 else .035
            noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=125 if rough>.8 else 85
            bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.047
            links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
            materials[key]=mat
        me=bpy.data.meshes.new('Relief layer')
        me.from_pydata(vertices,[],[index[i:i+3] for i in range(0,len(index),3)])
        ob=bpy.data.objects.new('Relief layer',me);bpy.context.collection.objects.link(ob);me.materials.append(materials[key])
        for poly in me.polygons: poly.use_smooth=True
    area('Left softbox',(-3.2,2.1,5.2),410,(1,.84,.68),3.5)
    area('Cool window',(4,4,3.5),230,(.74,.87,1),4.5)
    area('Soft front',(1,-4,3),110,(1,.95,.83),4)
    cam=bpy.data.cameras.new('Plate portrait');cam.type='ORTHO';cam.ortho_scale=4.76
    obj=bpy.data.objects.new('Plate portrait',cam);bpy.context.collection.objects.link(obj)
    obj.location=(.20,-3.8,8.3);aim(obj,(0,0,.10));scene.camera=obj
    scene.render.filepath=str(base/(model.stem+'.png'))
    bpy.ops.render.render(write_still=True)
